/**
 * Obtiene el catálogo de productos con fallback automático:
 * 1. Intenta leer desde Google Sheets vía Apps Script (si APPS_SCRIPT_URL está configurado)
 * 2. Si no, obtiene directamente desde la API de Contabilium
 */

import type { ProductoContabilium } from '@/types';

function sheetRowToProducto(r: Record<string, string>): ProductoContabilium {
  return {
    Id: Number(r['ID']),
    Codigo: r['Código'] ?? '',
    Descripcion: r['Descripción'] ?? '',
    PrecioVenta: Number(r['Precio Venta']) || 0,
    Unidad: r['Unidad'] ?? 'UN',
  };
}

export async function getProductos(): Promise<{
  productos: ProductoContabilium[];
  fuente: 'sheets' | 'contabilium';
}> {
  const hasScript = !!process.env.APPS_SCRIPT_URL?.trim() && !!process.env.APPS_SCRIPT_SECRET?.trim();

  if (hasScript) {
    try {
      const { readSheet } = await import('./appsScript');
      const rows = await readSheet<Record<string, string>>('Productos');
      const productos = rows
        .filter((r) => r['ID'] && r['Descripción'])
        .map(sheetRowToProducto);

      if (productos.length > 0) {
        return { productos, fuente: 'sheets' };
      }
      // Sheets vacío → caer a Contabilium
    } catch {
      // Error en Apps Script → caer a Contabilium
    }
  }

  // Fallback: obtener directo de Contabilium
  const { getConceptos } = await import('./contabilium');
  const productos = await getConceptos();
  return { productos, fuente: 'contabilium' };
}
