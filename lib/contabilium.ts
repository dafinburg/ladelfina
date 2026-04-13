import type {
  ClienteContabilium,
  ProductoContabilium,
  PedidoContabiliumPayload,
  RespuestaCrearPedido,
} from '@/types';

const BASE_URL = 'https://rest.contabilium.com';
const TOKEN_URL = 'https://rest.contabilium.com/token';

// ── Token cache ───────────────────────────────────────────────

interface TokenCache {
  token: string;
  expiresAt: number; // epoch ms
}

let tokenCache: TokenCache | null = null;

export async function getToken(): Promise<string> {
  const now = Date.now();

  if (tokenCache && tokenCache.expiresAt > now + 60_000) {
    return tokenCache.token;
  }

  const clientId = process.env.CONTABILIUM_CLIENT_ID;
  const clientSecret = process.env.CONTABILIUM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Faltan CONTABILIUM_CLIENT_ID o CONTABILIUM_CLIENT_SECRET en variables de entorno');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error al obtener token de Contabilium (${res.status}): ${text}`);
  }

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };

  return tokenCache.token;
}

// ── Helper de fetch autenticado ───────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    tokenCache = null;
    const freshToken = await getToken();
    const retry = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${freshToken}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!retry.ok) {
      const text = await retry.text();
      throw new Error(`Error ${retry.status} en ${path}: ${text}`);
    }
    return retry.json();
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error ${res.status} en ${path}: ${text}`);
  }

  return res.json();
}

// ── Tipos de respuesta real de la API ─────────────────────────

interface PaginatedResponse<T> {
  Items: T[];
  TotalItems: number;
  TotalPage: number; // Contabilium devuelve el pageSize, no el total de páginas
}

interface ClienteRaw {
  Id: number;
  RazonSocial: string;
  NombreFantasia: string;
  CondicionIva: string;
  TipoDoc: string;
  NroDoc: string;
  Email: string;
  Telefono: string;
  Codigo: string | null;
  Estado?: string;
}

interface ConceptoRaw {
  Id: number;
  Nombre: string;      // La API devuelve Nombre, no Descripcion
  Codigo: string;
  Precio: number;      // La API devuelve Precio, no PrecioVenta
  PrecioFinal: number;
  Estado: string;      // "Activo" | "Inactivo"
  Tipo: string;        // "Servicio" | "Producto" | "Bien"
  Unidad?: string;
}

// ── Paginación con respuesta { Items, TotalItems, TotalPage } ─

async function fetchAllSearchPages<TRaw>(
  endpoint: string,
  params: Record<string, string> = {},
  pageSize = 50,
): Promise<TRaw[]> {
  const all: TRaw[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const qp = new URLSearchParams({
      pageSize: String(pageSize),
      page: String(page),
      ...params,
    });

    const data = await apiFetch<PaginatedResponse<TRaw>>(`${endpoint}?${qp}`);

    const items = data.Items ?? [];
    all.push(...items);

    // TotalPage en Contabilium = pageSize devuelto (no total de páginas)
    // Calculamos el total de páginas real
    if (page === 1 && data.TotalItems > 0) {
      const ps = data.TotalPage > 0 ? data.TotalPage : pageSize;
      totalPages = Math.ceil(data.TotalItems / ps);
    }

    page++;
  } while (page <= totalPages);

  return all;
}

// ── Clientes ──────────────────────────────────────────────────

export async function getClientes(): Promise<ClienteContabilium[]> {
  const raw = await fetchAllSearchPages<ClienteRaw>('/api/clientes/search');

  return raw.map((c) => ({
    Id: c.Id,
    RazonSocial: c.RazonSocial ?? c.NombreFantasia ?? '',
    // Usamos NroDoc como Cuit (en Contabilium el CUIT se almacena en NroDoc cuando TipoDoc=CUIT)
    Cuit: c.NroDoc ?? '',
    CondicionIva: c.CondicionIva ?? '',
    CondicionPago: '',  // La API /search no devuelve CondicionPago
    Email: c.Email ?? '',
    Telefono: c.Telefono ?? '',
  }));
}

export async function getClientePorCuit(
  cuit: string,
  clientes?: ClienteContabilium[],
): Promise<ClienteContabilium | null> {
  const lista = clientes ?? (await getClientes());
  const cuitNorm = cuit.replace(/[^0-9]/g, '');
  return lista.find((c) => c.Cuit?.replace(/[^0-9]/g, '') === cuitNorm) ?? null;
}

// ── Conceptos (productos) ─────────────────────────────────────

export async function getConceptos(): Promise<ProductoContabilium[]> {
  const raw = await fetchAllSearchPages<ConceptoRaw>('/api/conceptos/search');

  // Filtrar solo activos y mapear campos al tipo interno
  return raw
    .filter((c) => !c.Estado || c.Estado === 'Activo')
    .map((c) => ({
      Id: c.Id,
      Codigo: c.Codigo ?? '',
      Descripcion: c.Nombre ?? '',         // API devuelve Nombre → mapeamos a Descripcion
      PrecioVenta: c.PrecioFinal ?? c.Precio ?? 0,  // Preferimos PrecioFinal, fallback Precio
      Unidad: c.Unidad ?? 'UN',
    }));
}

// ── Crear pedido ──────────────────────────────────────────────

export async function crearPedido(
  payload: PedidoContabiliumPayload,
): Promise<RespuestaCrearPedido> {
  return apiFetch<RespuestaCrearPedido>('/api/pedidos', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
