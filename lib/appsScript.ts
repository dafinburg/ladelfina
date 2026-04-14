/**
 * Cliente para la API de Google Apps Script (La Delfina Sheets API)
 * Alternativa a Service Account — no requiere claves JSON ni APIs habilitadas.
 *
 * Variables de entorno requeridas:
 *   APPS_SCRIPT_URL    = URL del Web App desplegado
 *   APPS_SCRIPT_SECRET = Token secreto (mismo valor que en el script)
 */

function getConfig() {
  const url = process.env.APPS_SCRIPT_URL?.trim();
  const secret = process.env.APPS_SCRIPT_SECRET?.trim();
  return { url, secret, ok: !!url && !!secret };
}

export function hasAppsScript(): boolean {
  return getConfig().ok;
}

async function callScript<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { url, secret, ok } = getConfig();
  if (!ok) throw new Error('APPS_SCRIPT_URL o APPS_SCRIPT_SECRET no configurados');

  const res = await fetch(url!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    redirect: 'follow',
    body: JSON.stringify({ ...body, token: secret }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apps Script error ${res.status}: ${text}`);
  }

  const data = await res.json() as { ok: boolean; error?: string } & T;
  if (!data.ok) throw new Error(data.error ?? 'Error desconocido en Apps Script');

  return data;
}

// ── Escribir hoja (reemplaza todo el contenido) ───────────────

export async function writeSheet(
  sheet: string,
  rows: (string | number | null)[][],
): Promise<{ rows: number }> {
  return callScript<{ rows: number }>({ action: 'write', sheet, data: rows });
}

// ── Leer hoja (devuelve array de objetos) ─────────────────────

export async function readSheet<T = Record<string, string>>(
  sheet: string,
): Promise<T[]> {
  const res = await callScript<{ rows: T[] }>({ action: 'read', sheet });
  return (res as unknown as { rows: T[] }).rows;
}

// ── Setup inicial de hojas ────────────────────────────────────

export async function setupSheets(): Promise<void> {
  await callScript({ action: 'setup' });
}
