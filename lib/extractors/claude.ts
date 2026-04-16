/**
 * Función compartida: llama a Claude para extraer datos estructurados
 * de texto de una orden de compra.
 */

import type { OrdenCompra } from '@/types';

const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

const EXTRACTION_PROMPT = `Eres un asistente especializado en extraer datos de órdenes de compra de empresas argentinas.

Analiza el siguiente texto de una orden de compra y extrae todos los datos estructurados en formato JSON.

IMPORTANTE:
- Si un campo no está disponible en el documento, usa null
- Las fechas deben estar en formato ISO: YYYY-MM-DD
- Los números deben ser numéricos (no strings), sin símbolos de moneda
- El CUIT debe estar sin guiones ni puntos, solo dígitos
- Si no puedes determinar la unidad de medida, usa "UN"

Devuelve ÚNICAMENTE el JSON sin ningún texto adicional, con esta estructura exacta:

{
  "numeroOrden": string | null,
  "fechaEmision": string | null,
  "fechaEntrega": string | null,
  "nombreCliente": string | null,
  "cuit": string | null,
  "direccionEntrega": string | null,
  "condicionPago": string | null,
  "items": [
    {
      "id": "1",
      "codigoCliente": string | null,
      "descripcion": string,
      "cantidad": number,
      "unidad": string,
      "precioUnitario": number | null,
      "importeTotal": number | null
    }
  ],
  "subtotal": number | null,
  "iva": number | null,
  "total": number | null
}

Texto de la orden de compra:
`;

export async function extractWithClaude(text: string): Promise<OrdenCompra> {
  if (!text || text.trim().length < 20) {
    throw new Error('El texto es demasiado corto para extraer una orden de compra');
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Falta ANTHROPIC_API_KEY en variables de entorno');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: EXTRACTION_PROMPT + text }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error en Claude API (${response.status}): ${errText}`);
  }

  const claudeResponse = await response.json();
  const content = claudeResponse.content?.[0]?.text;
  if (!content) throw new Error('Claude no devolvió contenido');

  let extracted: OrdenCompra;
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No se encontró JSON en la respuesta');
    extracted = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new Error(
      `Error al parsear la respuesta de Claude: ${err instanceof Error ? err.message : String(err)}\n\nRespuesta: ${content.substring(0, 500)}`,
    );
  }

  // Normalizar ítems
  if (extracted.items && Array.isArray(extracted.items)) {
    extracted.items = extracted.items.map((item, idx) => ({
      ...item,
      id: item.id ?? String(idx + 1),
      codigoCliente: item.codigoCliente ?? '',
      unidad: item.unidad ?? 'UN',
    }));
  } else {
    extracted.items = [];
  }

  return extracted;
}
