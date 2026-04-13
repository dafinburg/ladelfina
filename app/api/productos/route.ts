import { NextResponse } from 'next/server';
import { getSheetRows } from '@/lib/googleSheets';
import type { ProductoContabilium } from '@/types';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const rows = await getSheetRows<Record<string, string>>('Productos');

    const productos: ProductoContabilium[] = rows
      .filter((r) => r['ID'] && r['Descripción'])
      .map((r) => ({
        Id: Number(r['ID']),
        Codigo: r['Código'] ?? '',
        Descripcion: r['Descripción'] ?? '',
        PrecioVenta: Number(r['Precio Venta']) || 0,
        Unidad: r['Unidad'] ?? 'UN',
      }));

    return NextResponse.json({ productos });
  } catch (err) {
    console.error('[/api/productos] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error cargando productos' },
      { status: 500 },
    );
  }
}
