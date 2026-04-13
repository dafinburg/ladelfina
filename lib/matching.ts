/**
 * Fuzzy matching de productos del cliente contra el catálogo interno.
 * Usa fuse.js para búsqueda aproximada por descripción.
 */

import Fuse from 'fuse.js';
import type { ItemOrden, ItemMatcheado, ProductoContabilium } from '@/types';

const PRICE_DIFF_THRESHOLD = 0.01; // 1%

const FUSE_OPTIONS: Fuse.IFuseOptions<ProductoContabilium> = {
  keys: [
    { name: 'Descripcion', weight: 0.7 },
    { name: 'Codigo', weight: 0.3 },
  ],
  threshold: 0.6,       // 0 = coincidencia exacta, 1 = cualquier cosa
  includeScore: true,
  ignoreLocation: true,
  useExtendedSearch: false,
  minMatchCharLength: 3,
};

/**
 * Normaliza texto para mejorar el matching:
 * - Convierte a mayúsculas
 * - Elimina acentos
 * - Elimina caracteres especiales innecesarios
 */
function normalizeText(text: string): string {
  return text
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Crea un índice Fuse con los productos del catálogo interno.
 * Los productos son normalizados para mejor coincidencia.
 */
export function createSearchIndex(
  productos: ProductoContabilium[],
): Fuse<ProductoContabilium> {
  const normalized = productos.map((p) => ({
    ...p,
    Descripcion: normalizeText(p.Descripcion),
    Codigo: p.Codigo?.toUpperCase() ?? '',
  }));
  return new Fuse(normalized, FUSE_OPTIONS);
}

/**
 * Busca el producto más similar para un ítem de la orden del cliente.
 * Retorna el producto sugerido y el score de confianza (0-1, siendo 1 la mejor coincidencia).
 */
export function findBestMatch(
  item: ItemOrden,
  fuse: Fuse<ProductoContabilium>,
  originalProductos: ProductoContabilium[],
): { producto: ProductoContabilium | null; score: number } {
  const query = normalizeText(item.descripcion);
  const results = fuse.search(query, { limit: 1 });

  if (results.length === 0) {
    return { producto: null, score: 0 };
  }

  const best = results[0];
  // fuse.js score: 0 = exacto, 1 = sin coincidencia. Invertimos para score de confianza.
  const score = best.score !== undefined ? 1 - best.score : 0;

  // Recuperar el producto original (no normalizado) usando el índice
  const originalProduct = originalProductos[best.refIndex] ?? null;

  return { producto: originalProduct, score };
}

/**
 * Calcula si hay diferencia de precio significativa entre el precio
 * del cliente y el precio interno del producto.
 */
function calcDiferenciaPrecio(
  precioCliente: number | null,
  precioInterno: number,
): { alerta: boolean; diferencia: number | null } {
  if (precioCliente === null || precioCliente === 0) {
    return { alerta: false, diferencia: null };
  }

  const diff = Math.abs(precioCliente - precioInterno) / precioInterno;
  return {
    alerta: diff > PRICE_DIFF_THRESHOLD,
    diferencia: Math.round(diff * 1000) / 10, // porcentaje con 1 decimal
  };
}

/**
 * Aplica el matching a todos los ítems de la orden.
 */
export function matchItems(
  items: ItemOrden[],
  productos: ProductoContabilium[],
): ItemMatcheado[] {
  if (productos.length === 0) {
    return items.map((item) => ({
      itemOriginal: item,
      productoSugerido: null,
      scoreConfianza: 0,
      productoSeleccionado: null,
      estado: 'pendiente',
      alertaPrecio: false,
      diferenciaPrecio: null,
    }));
  }

  const fuse = createSearchIndex(productos);

  return items.map((item) => {
    const { producto, score } = findBestMatch(item, fuse, productos);

    const { alerta, diferencia } = producto
      ? calcDiferenciaPrecio(item.precioUnitario, producto.PrecioVenta)
      : { alerta: false, diferencia: null };

    return {
      itemOriginal: item,
      productoSugerido: producto,
      scoreConfianza: Math.round(score * 100) / 100,
      productoSeleccionado: score >= 0.6 ? producto : null, // Auto-aceptar si confianza >= 60%
      estado: score >= 0.6 ? 'aceptado' : 'pendiente',
      alertaPrecio: alerta,
      diferenciaPrecio: diferencia,
    } satisfies ItemMatcheado;
  });
}
