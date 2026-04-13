import { NextRequest, NextResponse } from 'next/server';
import { matchItems } from '@/lib/matching';
import { getProductos } from '@/lib/productos';
import type { ItemOrden } from '@/types';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { items }: { items: ItemOrden[] } = await req.json();

    if (!items?.length) {
      return NextResponse.json({ error: 'No se enviaron ítems' }, { status: 400 });
    }

    const { productos, fuente } = await getProductos();
    const itemsMatcheados = matchItems(items, productos);

    return NextResponse.json({ itemsMatcheados, fuente });
  } catch (err) {
    console.error('[/api/matching] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error en el matching' },
      { status: 500 },
    );
  }
}
