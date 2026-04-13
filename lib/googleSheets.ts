/**
 * Integración con Google Sheets via HTTP directo usando Service Account JWT.
 * NO usa la librería googleapis. Genera el JWT manualmente y lo intercambia
 * por un access token de OAuth2.
 */

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';
const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// ── JWT helpers ───────────────────────────────────────────────

function base64urlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlEncodeBuffer(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function signRS256(data: string, pemKey: string): Promise<string> {
  const { createSign } = await import('crypto');
  const sign = createSign('RSA-SHA256');
  sign.update(data);
  sign.end();
  const signature = sign.sign(pemKey);
  return base64urlEncodeBuffer(signature);
}

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

async function getServiceAccountToken(): Promise<string> {
  const jsonStr = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!jsonStr) {
    throw new Error('Falta GOOGLE_SERVICE_ACCOUNT_JSON en variables de entorno');
  }

  const sa: ServiceAccount = JSON.parse(jsonStr);
  const now = Math.floor(Date.now() / 1000);

  const header = base64urlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64urlEncode(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: OAUTH_TOKEN_URL,
      exp: now + 3600,
      iat: now,
    }),
  );

  const signingInput = `${header}.${claims}`;
  const signature = await signRS256(signingInput, sa.private_key);
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error obteniendo token de Google: ${text}`);
  }

  const data = await res.json();
  return data.access_token as string;
}

// ── Cache de token de Google ──────────────────────────────────

interface GoogleTokenCache {
  token: string;
  expiresAt: number;
}

let googleTokenCache: GoogleTokenCache | null = null;

async function getGoogleToken(): Promise<string> {
  const now = Date.now();
  if (googleTokenCache && googleTokenCache.expiresAt > now + 60_000) {
    return googleTokenCache.token;
  }
  const token = await getServiceAccountToken();
  googleTokenCache = { token, expiresAt: now + 3500 * 1000 };
  return token;
}

// ── Helpers de rango ──────────────────────────────────────────

function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SPREADSHEET_ID;
  if (!id) throw new Error('Falta GOOGLE_SPREADSHEET_ID en variables de entorno');
  return id;
}

function encodeRange(range: string): string {
  return encodeURIComponent(range);
}

// ── API pública ───────────────────────────────────────────────

/**
 * Lee todas las filas de una hoja.
 * Retorna array de arrays (la primera fila suele ser cabecera).
 */
export async function getSheetData(sheetName: string): Promise<string[][]> {
  const token = await getGoogleToken();
  const id = getSpreadsheetId();
  const range = encodeRange(`${sheetName}`);

  const res = await fetch(
    `${SHEETS_BASE}/${id}/values/${range}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error leyendo hoja "${sheetName}": ${text}`);
  }

  const data = await res.json();
  return (data.values as string[][]) ?? [];
}

/**
 * Lee filas y las convierte a objetos usando la primera fila como cabecera.
 */
export async function getSheetRows<T = Record<string, string>>(
  sheetName: string,
): Promise<T[]> {
  const rows = await getSheetData(sheetName);
  if (rows.length < 2) return [];

  const [headers, ...dataRows] = rows;
  return dataRows.map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] ?? '';
    });
    return obj as T;
  });
}

/**
 * Agrega filas al final de una hoja.
 */
export async function appendSheetRows(
  sheetName: string,
  rows: (string | number | null)[][],
): Promise<void> {
  const token = await getGoogleToken();
  const id = getSpreadsheetId();
  const range = encodeRange(`${sheetName}`);

  const res = await fetch(
    `${SHEETS_BASE}/${id}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Error agregando filas a "${sheetName}": ${text}`);
  }
}

/**
 * Borra el contenido de una hoja y escribe nuevas filas desde A1.
 */
export async function clearAndWriteSheet(
  sheetName: string,
  rows: (string | number | null)[][],
): Promise<void> {
  const token = await getGoogleToken();
  const id = getSpreadsheetId();
  const range = encodeRange(`${sheetName}`);

  // 1. Limpiar
  const clearRes = await fetch(
    `${SHEETS_BASE}/${id}/values/${range}:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!clearRes.ok) {
    const text = await clearRes.text();
    throw new Error(`Error limpiando hoja "${sheetName}": ${text}`);
  }

  // 2. Escribir
  const writeRes = await fetch(
    `${SHEETS_BASE}/${id}/values/${range}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: rows }),
    },
  );

  if (!writeRes.ok) {
    const text = await writeRes.text();
    throw new Error(`Error escribiendo hoja "${sheetName}": ${text}`);
  }
}
