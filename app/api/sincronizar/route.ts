import { NextRequest, NextResponse } from 'next/server';
import { getClientes, getConceptos } from '@/lib/contabilium';
import { clearAndWriteSheet } from '@/lib/googleSheets';
import type { ClienteContabilium, ProductoContabilium } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 120;

type SincTarget = 'clientes' | 'conceptos' | 'todo';

async function sincronizarClientes() {
  const clientes: ClienteContabilium[] = await getClientes();

  const headers = ['ID', 'Razón Social', 'CUIT', 'Condición IVA', 'Condición Pago', 'Email', 'Teléfono'];
  const rows = clientes.map((c) => [
    c.Id,
    c.RazonSocial ?? '',
    c.Cuit ?? '',
    c.CondicionIva ?? '',
    c.CondicionPago ?? '',
    c.Email ?? '',
    c.Telefono ?? '',
  ]);

  await clearAndWriteSheet('Clientes', [headers, ...rows]);
  return clientes.length;
}

async function sincronizarConceptos() {
  const conceptos: ProductoContabilium[] = await getConceptos();

  const headers = ['ID', 'Código', 'Descripción', 'Precio Venta', 'Unidad'];
  const rows = conceptos.map((c) => [
    c.Id,
    c.Codigo ?? '',
    c.Descripcion ?? '',
    c.PrecioVenta ?? 0,
    c.Unidad ?? 'UN',
  ]);

  await clearAndWriteSheet('Productos', [headers, ...rows]);
  return conceptos.length;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const target: SincTarget = body.target ?? 'todo';

    const resultado: {
      clientes?: { count: number; timestamp: string };
      conceptos?: { count: number; timestamp: string };
    } = {};

    const now = new Date().toISOString();

    if (target === 'clientes' || target === 'todo') {
      const count = await sincronizarClientes();
      resultado.clientes = { count, timestamp: now };
    }

    if (target === 'conceptos' || target === 'todo') {
      const count = await sincronizarConceptos();
      resultado.conceptos = { count, timestamp: now };
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
