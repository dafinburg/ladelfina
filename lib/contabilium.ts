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

  // Reutilizar token si sigue vigente (con 60s de margen)
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
    // Limpiar cache y reintentar una vez
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

// ── Paginación genérica (respuesta tipo array directo) ────────

async function fetchAllPages<T>(
  endpoint: string,
  extraParams: Record<string, string> = {},
  pageSize = 100,
): Promise<T[]> {
  const all: T[] = [];
  let page = 1;

  while (true) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      ...extraParams,
    });

    const data = await apiFetch<T[] | { Items?: T[]; items?: T[] }>(`${endpoint}?${params}`);

    // La API puede devolver array directo o { Items: [...] }
    const items: T[] = Array.isArray(data)
      ? data
      : (data as { Items?: T[]; items?: T[] }).Items ??
        (data as { Items?: T[]; items?: T[] }).items ??
        [];

    if (items.length === 0) break;

    all.push(...items);

    if (items.length < pageSize) break;
    page++;
  }

  return all;
}

// ── Clientes ──────────────────────────────────────────────────

export async function getClientes(): Promise<ClienteContabilium[]> {
  // Intentar con el endpoint de búsqueda (confirmado en n8n)
  try {
    return await fetchAllPages<ClienteContabilium>('/api/clientes/search');
  } catch {
    // Fallback al endpoint legacy
    return fetchAllPages<ClienteContabilium>('/clientes');
  }
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
  // Intentar con el endpoint de búsqueda (mismo patrón que clientes)
  try {
    return await fetchAllPages<ProductoContabilium>('/api/conceptos/search');
  } catch {
    // Fallback al endpoint legacy
    return fetchAllPages<ProductoContabilium>('/conceptos');
  }
}

// ── Crear pedido ──────────────────────────────────────────────

export async function crearPedido(
  payload: PedidoContabiliumPayload,
): Promise<RespuestaCrearPedido> {
  // Intentar con endpoint nuevo primero
  try {
    return await apiFetch<RespuestaCrearPedido>('/api/pedidos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch {
    return apiFetch<RespuestaCrearPedido>('/pedidos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}
