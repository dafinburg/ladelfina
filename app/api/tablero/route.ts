import { NextRequest, NextResponse } from 'next/server';
import { getToken } from '@/lib/contabilium';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BASE_URL = 'https://rest.contabilium.com';

interface ItemComprobante {
  Id: number;
  IdConcepto: number;
  Concepto: string;
  Codigo: string;
  Cantidad: number;
  PrecioUnitario: number;
  Tipo: string;
}

interface Comprobante {
  Id: number;
  IdCliente: number;
  RazonSocial: string;
  Numero: string;
  FechaEmision: string;
  FechaVencimiento: string;
  FechaServDesde: string | null;
  FechaServHasta: string | null;
  ImporteTotalBruto: string;
  Saldo: string;
  Items: ItemComprobante[] | null;
}

interface PaginatedResp<T> {
  Items: T[];
  TotalItems: number;
  TotalPage: number;
}

// ── Helpers ───────────────────────────────────────────────────

function parseArgFloat(s: string | null | undefined): number {
  if (!s) return 0;
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
}

function toDateStr(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return iso.split('T')[0];
}

// ── Fetch helpers ─────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error ${res.status} en ${path}: ${text.substring(0, 200)}`);
  }
  return res.json();
}

async function fetchAllCOT(desde: string, hasta: string): Promise<Comprobante[]> {
  const all: Comprobante[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const qp = new URLSearchParams({
      pageSize: '50', page: String(page),
      fechaDesde: desde, fechaHasta: hasta,
      tipoFc: 'COT',
    });
    const data = await apiFetch<PaginatedResp<Comprobante>>(
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

async function fetchAllClientes(): Promise<Map<number, { razonSocial: string; tags: string[] }>> {
  const map = new Map<number, { razonSocial: string; tags: string[] }>();
  let page = 1;
  let totalPages = 1;

  do {
    const qp = new URLSearchParams({ pageSize: '50', page: String(page) });
    const data = await apiFetch<PaginatedResp<{
      Id: number; RazonSocial: string; Tags: string | string[] | null
    }>>(`/api/clientes/search?${qp}`);

    for (const c of data.Items ?? []) {
      let tags: string[] = [];
      if (c.Tags) {
        tags = Array.isArray(c.Tags)
          ? c.Tags.map((t: string) => t.trim()).filter(Boolean)
          : String(c.Tags).split(',').map((t) => t.trim()).filter(Boolean);
      }
      map.set(c.Id, { razonSocial: c.RazonSocial, tags });
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
    const en30 = new Date(Date.now() + 30 * 86400000);

    const desde = searchParams.get('desde') ?? hoy.toISOString().split('T')[0];
    const hasta = searchParams.get('hasta') ?? en30.toISOString().split('T')[0];
    const tagsParam = searchParams.get('tags') ?? '';
    const filtroTags = tagsParam ? tagsParam.split(',').map((t) => t.trim()).filter(Boolean) : [];

    // Fetch en paralelo
    const [comprobantes, clientesMap] = await Promise.all([
      fetchAllCOT(desde, hasta),
      fetchAllClientes(),
    ]);

    // Recolectar todos los tags disponibles
    const allTagsSet = new Set<string>();
    for (const c of clientesMap.values()) {
      c.tags.forEach((t) => allTagsSet.add(t));
    }
    const allTags = [...allTagsSet].sort();

    // Filtrar por tags si aplica
    const comprobantesFiltrados = filtroTags.length === 0
      ? comprobantes
      : comprobantes.filter((comp) => {
          const cliente = clientesMap.get(comp.IdCliente);
          if (!cliente) return false;
          return filtroTags.some((ft) => cliente.tags.includes(ft));
        });

    // ── Agregar por producto × fecha ──────────────────────────
    // Usamos FechaVencimiento como fecha de entrega/producción
    // Si es null, usamos FechaEmision

    type ProdKey = string; // `${IdConcepto}`
    const fechasSet = new Set<string>();

    interface ProdInfo {
      id: number;
      nombre: string;
      codigo: string;
      porFecha: Record<string, number>;
      ordenes: string[];
    }

    const productos = new Map<ProdKey, ProdInfo>();

    for (const comp of comprobantesFiltrados) {
      if (!comp.Items || comp.Items.length === 0) continue;

      const fechaEntrega =
        toDateStr(comp.FechaServHasta) ??
        toDateStr(comp.FechaVencimiento) ??
        toDateStr(comp.FechaEmision) ??
        desde;

      // Solo incluir si la fecha está en el rango solicitado
      if (fechaEntrega < desde || fechaEntrega > hasta) continue;

      fechasSet.add(fechaEntrega);

      for (const item of comp.Items) {
        if (!item.IdConcepto || item.Cantidad <= 0) continue;

        const key: ProdKey = String(item.IdConcepto);

        if (!productos.has(key)) {
          productos.set(key, {
            id: item.IdConcepto,
            nombre: item.Concepto ?? '',
            codigo: item.Codigo ?? '',
            porFecha: {},
            ordenes: [],
          });
        }

        const prod = productos.get(key)!;
        prod.porFecha[fechaEntrega] = (prod.porFecha[fechaEntrega] ?? 0) + item.Cantidad;

        if (!prod.ordenes.includes(comp.Numero)) {
          prod.ordenes.push(comp.Numero);
        }
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
        cantOrdenes: p.ordenes.length,
      }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      ok: true,
      desde,
      hasta,
      fechas,
      rows,
      totalOrdenes: comprobantesFiltrados.length,
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
