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

// ── Paginación genérica ───────────────────────────────────────

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
      rows: String(pageSize),
      ...extraParams,
    });

    const data = await apiFetch<T[]>(`${endpoint}?${params}`);

    if (!Array.isArray(data) || data.length === 0) break;

    all.push(...data);

    if (data.length < pageSize) break;
    page++;
  }

  return all;
}

// ── Clientes ──────────────────────────────────────────────────

export async function getClientes(): Promise<ClienteContabilium[]> {
  return fetchAllPages<ClienteContabilium>('/clientes');
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
  return fetchAllPages<ProductoContabilium>('/conceptos');
}

// ── Crear pedido ──────────────────────────────────────────────

export async function crearPedido(
  payload: PedidoContabiliumPayload,
): Promise<RespuestaCrearPedido> {
  return apiFetch<RespuestaCrearPedido>('/pedidos', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
