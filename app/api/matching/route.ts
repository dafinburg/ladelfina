import { NextRequest, NextResponse } from 'next/server';
import { getSheetRows } from '@/lib/googleSheets';
import { matchItems } from '@/lib/matching';
import type { ItemOrden, ProductoContabilium } from '@/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { items }: { items: ItemOrden[] } = await req.json();

    if (!items?.length) {
      return NextResponse.json({ error: 'No se enviaron ítems' }, { status: 400 });
    }

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

    const itemsMatcheados = matchItems(items, productos);

    return NextResponse.json({ itemsMatcheados });
  } catch (err) {
    console.error('[/api/matching] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error en el matching' },
      { status: 500 },
    );
  }
}
