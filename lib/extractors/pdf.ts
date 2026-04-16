import { extractWithClaude } from './claude';
import type { OrdenCompra } from '@/types';

export async function extractFromPDF(fileBuffer: Buffer): Promise<OrdenCompra> {
  const pdfParse = (await import('pdf-parse')).default;

  let pdfText: string;
  try {
    const data = await pdfParse(fileBuffer);
    pdfText = data.text;
  } catch (err) {
    throw new Error(`Error al parsear el PDF: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!pdfText || pdfText.trim().length < 20) {
    throw new Error('El PDF no contiene texto extraíble o está vacío');
  }

  return extractWithClaude(pdfText);
}
