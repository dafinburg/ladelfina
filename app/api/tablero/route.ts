import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/contabilium';

export const runtime = 'nodejs';
export const maxDuration = 120;

const BASE_URL = 'https://rest.contabilium.com';

interface ItemComprobante {
  Id: number;
  IdConcepto: number;
  Concepto: string;
  Codigo: string;
  Cantidad: number;
  PrecioUnitario: number;
  Tipo: string;
  IdRubro: number;
}

interface ComprobanteListItem {
  Id: number;
  IdCliente: number;
  RazonSocial: string;
  Numero: string;
  FechaEmision: string;
  FechaVencimiento: string | null;
  FechaServDesde: string | null;
  FechaServHasta: string | null;
  TipoFc: string;
  Items: ItemComprobante[] | null;
}

interface ComprobanteDetalle extends ComprobanteListItem {
  Items: ItemComprobante[] | null;
}

interface PaginatedResp<T> {
  Items: T[];
  TotalItems: number;
  TotalPage: number;
}

// ── Helpers ───────────────────────────────────────────────────

function toDateStr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return iso.split('T')[0];
}

async function getAuthHeader(): Promise<string> {
  const token = await getToken();
  return `Bearer ${token}`;
}

async function apiFetch<T>(path: string): Promise<T> {
  const auth = await getAuthHeader();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error ${res.status} en ${path}: ${text.substring(0, 200)}`);
  }
  return res.json();
}

// Ejecuta promesas en lotes para no saturar la API
async function batchRun<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 15,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fn));
    for (const r of batchResults) {
      if (r.status === 'fulfilled') results.push(r.value);
    }
  }
  return results;
}

// Trae todos los COT del rango de emisión
async function fetchCOTList(desdeEmision: string, hastaEmision: string): Promise<ComprobanteListItem[]> {
  const all: ComprobanteListItem[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const qp = new URLSearchParams({
      pageSize: '50', page: String(page),
      fechaDesde: desdeEmision,
      fechaHasta: hastaEmision,
      tipoFc: 'COT',
    });
    const data = await apiFetch<PaginatedResp<ComprobanteListItem>>(
      `/api/comprobantes/search?${qp}`,
    );
    all.push(...(data.Items ?? []));
    if (page === 1 && data.TotalItems > 0) {
      const ps = data.TotalPage > 0 ? data.TotalPage : 50;
      totalPages = Math.ceil(data.TotalItems / ps);
    }
    page++;
  } while (page <= totalPages);

  return all;
}

// Trae el detalle de un comprobante (con Items)
async function fetchDetalle(id: number): Promise<ComprobanteDetalle> {
  return apiFetch<ComprobanteDetalle>(`/api/comprobantes/${id}`);
}

// Trae todos los clientes con sus tags
async function fetchClientesMap(): Promise<Map<number, { razonSocial: string; tags: string[] }>> {
  const map = new Map<number, { razonSocial: string; tags: string[] }>();
  let page = 1;
  let totalPages = 1;

  do {
    const qp = new URLSearchParams({ pageSize: '50', page: String(page) });
    const data = await apiFetch<PaginatedResp<{
      Id: number; RazonSocial: string; NombreFantasia: string; Tags: string | string[] | null
    }>>(`/api/clientes/search?${qp}`);

    for (const c of data.Items ?? []) {
      let tags: string[] = [];
      if (c.Tags) {
        tags = Array.isArray(c.Tags)
          ? c.Tags.map((t) => t.trim()).filter(Boolean)
          : String(c.Tags).split(',').map((t) => t.trim()).filter(Boolean);
      }
      map.set(c.Id, { razonSocial: c.RazonSocial || c.NombreFantasia || '', tags });
    }

    if (page === 1 && data.TotalItems > 0) {
      const ps = data.TotalPage > 0 ? data.TotalPage : 50;
      totalPages = Math.ceil(data.TotalItems / ps);
    }
    page++;
  } while (page <= totalPages);

  return map;
}

// ── GET /api/tablero ──────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const hoy = new Date();

    // Fechas de entrega (FechaVencimiento) que el usuario quiere ver
    const desdeVenc = searchParams.get('desde') ?? hoy.toISOString().split('T')[0];
    const hastaVenc = searchParams.get('hasta') ?? new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const tagsParam = searchParams.get('tags') ?? '';
    const filtroTags = tagsParam ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean) : [];

    // Buscamos COT emitidas hasta 90 días antes de la fecha de vencimiento
    // para capturar todos los pedidos con entrega en el rango solicitado
    const desdeEmision = new Date(new Date(desdeVenc).getTime() - 90 * 86400000)
      .toISOString().split('T')[0];
    const hastaEmision = hastaVenc;

    // Fetch lista y clientes en paralelo
    const [cotList, clientesMap] = await Promise.all([
      fetchCOTList(desdeEmision, hastaEmision),
      fetchClientesMap(),
    ]);

    // Filtrar: solo COT cuya FechaVencimiento cae en el rango solicitado
    const cotEnRango = cotList.filter((c) => {
      const fv = toDateStr(c.FechaVencimiento ?? c.FechaServHasta ?? c.FechaEmision);
      if (!fv) return false;
      return fv >= desdeVenc && fv <= hastaVenc;
    });

    // Filtrar por tags si aplica
    const cotFiltradoTags = filtroTags.length === 0
      ? cotEnRango
      : cotEnRango.filter((c) => {
          const cliente = clientesMap.get(c.IdCliente);
          if (!cliente) return false;
          return filtroTags.some((ft) => cliente.tags.includes(ft));
        });

    // Fetch detalles en paralelo (para obtener Items)
    const detalles = await batchRun(
      cotFiltradoTags,
      (c) => fetchDetalle(c.Id),
      15,
    );

    // Recolectar todos los tags disponibles
    const allTagsSet = new Set<string>();
    for (const c of clientesMap.values()) {
      c.tags.forEach((t) => allTagsSet.add(t));
    }
    const allTags = [...allTagsSet].sort();

    // ── Agregar por producto × FechaVencimiento ───────────────

    const fechasSet = new Set<string>();

    interface ProdInfo {
      id: number;
      nombre: string;
      codigo: string;
      porFecha: Record<string, number>;
      ordenes: Set<string>;
    }

    const productos = new Map<string, ProdInfo>();

    for (const det of detalles) {
      if (!det.Items || det.Items.length === 0) continue;

      const fechaEntrega =
        toDateStr(det.FechaVencimiento ?? det.FechaServHasta ?? det.FechaEmision) ?? desdeVenc;

      if (fechaEntrega < desdeVenc || fechaEntrega > hastaVenc) continue;

      fechasSet.add(fechaEntrega);

      for (const item of det.Items) {
        if (!item.IdConcepto || item.Cantidad <= 0) continue;

        const key = String(item.IdConcepto);

        if (!productos.has(key)) {
          productos.set(key, {
            id: item.IdConcepto,
            nombre: item.Concepto ?? '',
            codigo: item.Codigo ?? '',
            porFecha: {},
            ordenes: new Set(),
          });
        }

        const prod = productos.get(key)!;
        prod.porFecha[fechaEntrega] = (prod.porFecha[fechaEntrega] ?? 0) + item.Cantidad;
        prod.ordenes.add(det.Numero);
      }
    }

    const fechas = [...fechasSet].sort();

    const rows = [...productos.values()]
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        codigo: p.codigo,
        porFecha: p.porFecha,
        total: Object.values(p.porFecha).reduce((s, v) => s + v, 0),
        cantOrdenes: p.ordenes.size,
      }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      ok: true,
      desde: desdeVenc,
      hasta: hastaVenc,
      fechas,
      rows,
      totalOrdenes: cotFiltradoTags.length,
      allTags,
      filtroTags,
    });

  } catch (err) {
    console.error('[/api/tablero] Error:', err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Error desconocido' },
      { status: 500 },
    );
  }
}
