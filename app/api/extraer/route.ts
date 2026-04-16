import { NextRequest, NextResponse } from 'next/server';
import { extractFromPDF } from '@/lib/extractors/pdf';
import { extractFromExcel } from '@/lib/extractors/excel';
import { extractWithClaude } from '@/lib/extractors/claude';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? '';

    // ── Modo texto plano (JSON body con { text }) ─────────────
    if (contentType.includes('application/json')) {
      const body = await req.json();
      const text: string = body.text ?? '';

      if (!text.trim()) {
        return NextResponse.json({ error: 'El texto está vacío' }, { status: 400 });
      }

      const orden = await extractWithClaude(text);
      return NextResponse.json({ orden });
    }

    // ── Modo archivo (multipart/form-data) ────────────────────
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No se recibió ningún archivo ni texto' }, { status: 400 });
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
        { error: 'Tipo de archivo no soportado. Usá PDF o Excel (.xlsx, .xls)' },
        { status: 400 },
      );
    }

    return NextResponse.json({ orden });
  } catch (err) {
    console.error('[/api/extraer] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error desconocido al extraer' },
      { status: 500 },
    );
  }
}
