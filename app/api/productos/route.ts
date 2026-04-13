import { NextResponse } from 'next/server';
import { getProductos } from '@/lib/productos';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const { productos, fuente } = await getProductos();
    return NextResponse.json({ productos, fuente });
  } catch (err) {
    console.error('[/api/productos] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error cargando productos' },
      { status: 500 },
    );
  }
}
