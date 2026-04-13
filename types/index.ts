// ============================================================
// TIPOS DE DOMINIO — Productos La Delfina SRL
// ============================================================

// ── Orden de compra del cliente ──────────────────────────────

export interface ItemOrden {
  id: string;
  codigoCliente: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  precioUnitario: number | null;
  importeTotal: number | null;
}

export interface OrdenCompra {
  numeroOrden: string;
  fechaEmision: string;       // ISO date string
  fechaEntrega: string;       // ISO date string
  nombreCliente: string;
  cuit: string;
  direccionEntrega: string;
  condicionPago: string;
  items: ItemOrden[];
  subtotal: number | null;
  iva: number | null;
  total: number | null;
}

// ── Maestros (Contabilium) ────────────────────────────────────

export interface ClienteContabilium {
  Id: number;
  RazonSocial: string;
  Cuit: string;
  CondicionIva: string;
  CondicionPago: string;
  Email?: string;
  Telefono?: string;
}

export interface ProductoContabilium {
  Id: number;
  Codigo: string;
  Descripcion: string;
  PrecioVenta: number;
  Unidad: string;
  Stock?: number;
}

// ── Matching de productos ─────────────────────────────────────

export type EstadoMatching = 'pendiente' | 'aceptado' | 'corregido' | 'sin-match';

export interface ItemMatcheado {
  itemOriginal: ItemOrden;
  productoSugerido: ProductoContabilium | null;
  scoreConfianza: number;           // 0-1
  productoSeleccionado: ProductoContabilium | null;
  estado: EstadoMatching;
  alertaPrecio: boolean;
  diferenciaPrecio: number | null;  // porcentaje
}

// ── Payload para crear pedido en Contabilium ─────────────────

export interface ItemPedidoContabilium {
  ConceptoId: number;
  Descripcion: string;
  Cantidad: number;
  Precio: number;
  Descuento: number;
}

export interface PedidoContabiliumPayload {
  ClienteId: number;
  Fecha: string;
  FechaEntrega: string;
  Observaciones: string;
  Items: ItemPedidoContabilium[];
}

// ── Respuesta de la API de Contabilium ───────────────────────

export interface RespuestaCrearPedido {
  Id: number;
  Numero: string;
  [key: string]: unknown;
}

// ── Historial de cargas ──────────────────────────────────────

export interface RegistroHistorial {
  fechaCarga: string;
  numeroOC: string;
  nombreCliente: string;
  total: number;
  numeroPedido: string;
}

// ── Estado del stepper ────────────────────────────────────────

export type PasoStepper = 1 | 2 | 3 | 4;

export interface EstadoApp {
  paso: PasoStepper;
  ordenExtraida: OrdenCompra | null;
  itemsMatcheados: ItemMatcheado[];
  clienteId: number | null;
  pedidoCargado: RespuestaCrearPedido | null;
  cargando: boolean;
  error: string | null;
}

// ── Sincronización de maestros ────────────────────────────────

export interface EstadoSincronizacion {
  ultimaSincClientes: string | null;
  ultimaSincProductos: string | null;
  sincronizando: boolean;
  error: string | null;
}
