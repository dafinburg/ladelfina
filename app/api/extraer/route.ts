import { NextRequest, NextResponse } from 'next/server';
import { extractFromPDF } from '@/lib/extractors/pdf';
import { extractFromExcel } from '@/lib/extractors/excel';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = file.name.toLowerCase();

    let orden;

    if (filename.endsWith('.pdf')) {
      orden = await extractFromPDF(buffer);
    } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
      orden = await extractFromExcel(buffer);
    } else {
      return NextResponse.json(
        { error: 'Tipo de archivo no soportado. Use PDF o Excel (.xlsx, .xls)' },
        { status: 400 },
      );
    }

    return NextResponse.json({ orden });
  } catch (err) {
    console.error('[/api/extraer] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error desconocido al extraer el archivo' },
      { status: 500 },
    );
  }
}
