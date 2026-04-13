/**
 * Extractor de órdenes de compra desde archivos Excel (.xlsx, .xls).
 * Usa la librería xlsx para parsear el archivo y busca columnas por nombre aproximado.
 */

import type { OrdenCompra, ItemOrden } from '@/types';

// Mapas de nombres de columna (lowercase, sin acentos) → campo interno
const COLUMN_ALIASES: Record<string, keyof ItemOrden> = {
  // Código
  'codigo': 'codigoCliente',
  'code': 'codigoCliente',
  'cod': 'codigoCliente',
  'sku': 'codigoCliente',
  'art': 'codigoCliente',
  'articulo': 'codigoCliente',
  'item': 'codigoCliente',
  // Descripción
  'descripcion': 'descripcion',
  'description': 'descripcion',
  'detalle': 'descripcion',
  'producto': 'descripcion',
  'nombre': 'descripcion',
  'material': 'descripcion',
  // Cantidad
  'cantidad': 'cantidad',
  'cant': 'cantidad',
  'qty': 'cantidad',
  'quantity': 'cantidad',
  'ctd': 'cantidad',
  // Unidad
  'unidad': 'unidad',
  'um': 'unidad',
  'uom': 'unidad',
  'unit': 'unidad',
  'unid': 'unidad',
  // Precio unitario
  'precio': 'precioUnitario',
  'price': 'precioUnitario',
  'p unitario': 'precioUnitario',
  'precio unitario': 'precioUnitario',
  'unit price': 'precioUnitario',
  'pu': 'precioUnitario',
  // Importe total
  'importe': 'importeTotal',
  'total': 'importeTotal',
  'subtotal': 'importeTotal',
  'monto': 'importeTotal',
  'amount': 'importeTotal',
  'importe total': 'importeTotal',
};

function normalizeKey(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(String(val).replace(/[^0-9.,\-]/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function toString(val: unknown): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

// Busca un campo de cabecera en las primeras filas por patrones conocidos
function findHeaderField(
  rows: unknown[][],
  patterns: string[],
): string | null {
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    for (const cell of rows[r]) {
      const norm = normalizeKey(toString(cell));
      for (const p of patterns) {
        if (norm.includes(p)) return toString(cell);
      }
    }
  }
  return null;
}

function findFieldValue(
  rows: unknown[][],
  patterns: string[],
): string | null {
  for (let r = 0; r < Math.min(15, rows.length); r++) {
    for (let c = 0; c < rows[r].length; c++) {
      const norm = normalizeKey(toString(rows[r][c]));
      for (const p of patterns) {
        if (norm.includes(p)) {
          // Valor en la celda siguiente (misma fila, columna+1)
          const nextCell = rows[r][c + 1];
          if (nextCell !== undefined && nextCell !== '') return toString(nextCell);
          // O en la celda de abajo
          const belowCell = rows[r + 1]?.[c];
          if (belowCell !== undefined && belowCell !== '') return toString(belowCell);
        }
      }
    }
  }
  return null;
}

// Detecta la fila de cabecera de la tabla de ítems
function findItemsTableHeader(
  rows: unknown[][],
): { headerRow: number; colMap: Record<keyof ItemOrden, number> } | null {
  for (let r = 0; r < Math.min(20, rows.length); r++) {
    const row = rows[r];
    const colMap: Partial<Record<keyof ItemOrden, number>> = {};

    for (let c = 0; c < row.length; c++) {
      const norm = normalizeKey(toString(row[c]));
      const field = COLUMN_ALIASES[norm];
      if (field) {
        colMap[field] = c;
      }
    }

    // Necesitamos al menos descripción y cantidad
    if (colMap.descripcion !== undefined && colMap.cantidad !== undefined) {
      return { headerRow: r, colMap: colMap as Record<keyof ItemOrden, number> };
    }
  }
  return null;
}

export async function extractFromExcel(fileBuffer: Buffer): Promise<OrdenCompra> {
  const XLSX = await import('xlsx');

  let workbook: ReturnType<typeof XLSX.read>;
  try {
    workbook = XLSX.read(fileBuffer, { type: 'buffer' });
  } catch (err) {
    throw new Error(`Error al parsear el Excel: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Usar la primera hoja
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error('El archivo Excel no tiene hojas');

  const sheet = workbook.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  if (rows.length === 0) throw new Error('La hoja Excel está vacía');

  // ── Extraer cabecera de la orden ─────────────────────────────

  const numeroOrden = findFieldValue(rows, ['orden', 'order', 'oc', 'pedido', 'numero', 'nro', 'n°']);
  const fechaEmision = findFieldValue(rows, ['emision', 'fecha', 'date', 'emitida']);
  const fechaEntrega = findFieldValue(rows, ['entrega', 'delivery', 'requerida', 'solicitada']);
  const nombreCliente = findFieldValue(rows, ['cliente', 'razon', 'empresa', 'comprador', 'proveedor']);
  const cuit = findFieldValue(rows, ['cuit', 'cuit/cuil', 'ruc', 'tax']);
  const direccionEntrega = findFieldValue(rows, ['direccion', 'domicilio', 'address', 'entrega dir']);
  const condicionPago = findFieldValue(rows, ['pago', 'condicion', 'payment', 'forma de pago']);

  // ── Detectar tabla de ítems ───────────────────────────────────

  const tableInfo = findItemsTableHeader(rows);
  const items: ItemOrden[] = [];

  if (tableInfo) {
    const { headerRow, colMap } = tableInfo;

    for (let r = headerRow + 1; r < rows.length; r++) {
      const row = rows[r];

      // Saltar filas vacías
      const descripcion = colMap.descripcion !== undefined
        ? toString(row[colMap.descripcion])
        : '';

      if (!descripcion) {
        // Si encontramos "subtotal", "total", etc., parar
        const rowText = row.join(' ').toLowerCase();
        if (rowText.includes('total') || rowText.includes('subtotal')) break;
        continue;
      }

      const cantidad = colMap.cantidad !== undefined
        ? toNumber(row[colMap.cantidad]) ?? 1
        : 1;

      items.push({
        id: String(r - headerRow),
        codigoCliente: colMap.codigoCliente !== undefined
          ? toString(row[colMap.codigoCliente])
          : '',
        descripcion,
        cantidad,
        unidad: colMap.unidad !== undefined
          ? toString(row[colMap.unidad]) || 'UN'
          : 'UN',
        precioUnitario: colMap.precioUnitario !== undefined
          ? toNumber(row[colMap.precioUnitario])
          : null,
        importeTotal: colMap.importeTotal !== undefined
          ? toNumber(row[colMap.importeTotal])
          : null,
      });
    }
  }

  // Buscar totales en las últimas filas
  let subtotal: number | null = null;
  let iva: number | null = null;
  let total: number | null = null;

  for (let r = Math.max(0, rows.length - 10); r < rows.length; r++) {
    const row = rows[r];
    for (let c = 0; c < row.length - 1; c++) {
      const label = normalizeKey(toString(row[c]));
      const val = toNumber(row[c + 1]);
      if (label.includes('subtotal') && val) subtotal = val;
      else if ((label.includes('iva') || label.includes('impuesto')) && val) iva = val;
      else if (label === 'total' && val) total = val;
    }
  }

  return {
    numeroOrden: numeroOrden ?? '',
    fechaEmision: fechaEmision ?? new Date().toISOString().split('T')[0],
    fechaEntrega: fechaEntrega ?? '',
    nombreCliente: nombreCliente ?? '',
    cuit: cuit?.replace(/[^0-9]/g, '') ?? '',
    direccionEntrega: direccionEntrega ?? '',
    condicionPago: condicionPago ?? '',
    items,
    subtotal,
    iva,
    total,
  };
}
