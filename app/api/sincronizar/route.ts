import { NextRequest, NextResponse } from 'next/server';
import { getClientes, getConceptos } from '@/lib/contabilium';
import type { ClienteContabilium, ProductoContabilium } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

type SincTarget = 'clientes' | 'conceptos' | 'todo';

const hasSheets = () =>
  !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim().startsWith('{');

async function sincronizarClientes() {
  const clientes: ClienteContabilium[] = await getClientes();

  if (hasSheets()) {
    const { clearAndWriteSheet } = await import('@/lib/googleSheets');
    const headers = ['ID', 'Razón Social', 'CUIT', 'Condición IVA', 'Email', 'Teléfono'];
    const rows = clientes.map((c) => [
      c.Id,
      c.RazonSocial ?? '',
      c.Cuit ?? '',
      c.CondicionIva ?? '',
      c.Email ?? '',
      c.Telefono ?? '',
    ]);
    await clearAndWriteSheet('Clientes', [headers, ...rows]);
  }

  return { count: clientes.length, sheets: hasSheets() };
}

async function sincronizarConceptos() {
  const conceptos: ProductoContabilium[] = await getConceptos();

  if (hasSheets()) {
    const { clearAndWriteSheet } = await import('@/lib/googleSheets');
    const headers = ['ID', 'Código', 'Descripción', 'Precio Venta', 'Unidad'];
    const rows = conceptos.map((c) => [
      c.Id,
      c.Codigo ?? '',
      c.Descripcion ?? '',
      c.PrecioVenta ?? 0,
      c.Unidad ?? 'UN',
    ]);
    await clearAndWriteSheet('Productos', [headers, ...rows]);
  }

  return { count: conceptos.length, sheets: hasSheets() };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const target: SincTarget = body.target ?? 'todo';

    const resultado: {
      clientes?: { count: number; timestamp: string; sheets: boolean };
      conceptos?: { count: number; timestamp: string; sheets: boolean };
      advertencia?: string;
    } = {};

    const now = new Date().toISOString();

    if (!hasSheets()) {
      resultado.advertencia =
        'GOOGLE_SERVICE_ACCOUNT_JSON no configurado — datos verificados desde Contabilium pero no guardados en Google Sheets.';
    }

    if (target === 'clientes' || target === 'todo') {
      const { count, sheets } = await sincronizarClientes();
      resultado.clientes = { count, timestamp: now, sheets };
    }

    if (target === 'conceptos' || target === 'todo') {
      const { count, sheets } = await sincronizarConceptos();
      resultado.conceptos = { count, timestamp: now, sheets };
    }

    return NextResponse.json({ ok: true, resultado });
  } catch (err) {
    console.error('[/api/sincronizar] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error desconocido al sincronizar' },
      { status: 500 },
    );
  }
}
