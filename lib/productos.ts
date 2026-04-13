/**
 * Obtiene el catálogo de productos con fallback automático:
 * 1. Intenta leer desde Google Sheets (si GOOGLE_SERVICE_ACCOUNT_JSON está configurado)
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
  const hasSheets = !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim().startsWith('{');

  if (hasSheets) {
    try {
      const { getSheetRows } = await import('./googleSheets');
      const rows = await getSheetRows<Record<string, string>>('Productos');
      const productos = rows
        .filter((r) => r['ID'] && r['Descripción'])
        .map(sheetRowToProducto);

      if (productos.length > 0) {
        return { productos, fuente: 'sheets' };
      }
      // Sheets vacío → caer a Contabilium
    } catch {
      // Error en Sheets → caer a Contabilium
    }
  }

  // Fallback: obtener directo de Contabilium
  const { getConceptos } = await import('./contabilium');
  const productos = await getConceptos();
  return { productos, fuente: 'contabilium' };
}
