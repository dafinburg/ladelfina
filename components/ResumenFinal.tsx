'use client';

import type { OrdenCompra, ItemMatcheado, RespuestaCrearPedido } from '@/types';

interface ResumenFinalProps {
  orden: OrdenCompra;
  itemsMatcheados: ItemMatcheado[];
  onCargar: () => void;
  onVolver: () => void;
  onNuevaOrden: () => void;
  cargando: boolean;
  resultado: RespuestaCrearPedido | null;
  error: string | null;
}

export function ResumenFinal({
  orden,
  itemsMatcheados,
  onCargar,
  onVolver,
  onNuevaOrden,
  cargando,
  resultado,
  error,
}: ResumenFinalProps) {
  const totalCalculado = itemsMatcheados.reduce(
    (sum, im) => sum + im.itemOriginal.cantidad * (im.productoSeleccionado?.PrecioVenta ?? 0),
    0,
  );

  const total = orden.total ?? totalCalculado;

  if (resultado) {
    return (
      <div className="flex flex-col items-center gap-6 py-10">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
          <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800">¡Pedido cargado exitosamente!</h2>
          <p className="text-gray-500 mt-1">
            La orden fue registrada en Contabilium
          </p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-8 py-5 text-center">
          <p className="text-sm text-gray-500">Número de pedido</p>
          <p className="text-4xl font-black text-blue-600 mt-1">
            {resultado.Numero ?? resultado.Id}
          </p>
          <p className="text-sm text-gray-400 mt-1">OC: {orden.numeroOrden} — {orden.nombreCliente}</p>
        </div>
        <button
          onClick={onNuevaOrden}
          className="px-8 py-3 text-base font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-colors"
        >
          Cargar nueva orden
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Datos del cliente */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
          Datos del pedido
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-gray-400 block text-xs">Cliente</span>
            <span className="font-semibold">{orden.nombreCliente || '—'}</span>
          </div>
          <div>
            <span className="text-gray-400 block text-xs">CUIT</span>
            <span className="font-semibold">{orden.cuit || '—'}</span>
          </div>
          <div>
            <span className="text-gray-400 block text-xs">N° OC</span>
            <span className="font-semibold">{orden.numeroOrden || '—'}</span>
          </div>
          <div>
            <span className="text-gray-400 block text-xs">Fecha emisión</span>
            <span className="font-semibold">{orden.fechaEmision || '—'}</span>
          </div>
          <div>
            <span className="text-gray-400 block text-xs">Fecha entrega</span>
            <span className="font-semibold">{orden.fechaEntrega || '—'}</span>
          </div>
          <div>
            <span className="text-gray-400 block text-xs">Condición de pago</span>
            <span className="font-semibold">{orden.condicionPago || '—'}</span>
          </div>
          {orden.direccionEntrega && (
            <div className="col-span-2 md:col-span-3">
              <span className="text-gray-400 block text-xs">Dirección de entrega</span>
              <span className="font-semibold">{orden.direccionEntrega}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabla de ítems confirmados */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
            Ítems ({itemsMatcheados.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Cód. interno</th>
                <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Cant.</th>
                <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Precio</th>
                <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {itemsMatcheados.map((im) => {
                const precio = im.productoSeleccionado?.PrecioVenta ?? 0;
                const subtotal = im.itemOriginal.cantidad * precio;
                return (
                  <tr key={im.itemOriginal.id} className="hover:bg-gray-50/50">
                    <td className="py-2.5 px-4">
                      <p className="font-medium">{im.productoSeleccionado?.Descripcion ?? im.itemOriginal.descripcion}</p>
                      <p className="text-xs text-gray-400">{im.itemOriginal.descripcion}</p>
                    </td>
                    <td className="py-2.5 px-4 text-gray-500 font-mono text-xs">
                      {im.productoSeleccionado?.Codigo}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {im.itemOriginal.cantidad} {im.itemOriginal.unidad}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      ${precio.toLocaleString('es-AR')}
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold">
                      ${subtotal.toLocaleString('es-AR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={4} className="py-3 px-4 text-right font-bold text-sm">
                  Total del pedido
                </td>
                <td className="py-3 px-4 text-right font-black text-base">
                  ${totalCalculado.toLocaleString('es-AR')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
          <p className="font-semibold">Error al cargar la orden:</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* Acciones */}
      <div className="flex justify-between">
        <button
          onClick={onVolver}
          disabled={cargando}
          className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          Volver
        </button>
        <button
          onClick={onCargar}
          disabled={cargando}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {cargando ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Cargando en Contabilium...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Cargar orden en Contabilium
            </>
          )}
        </button>
      </div>
    </div>
  );
}
