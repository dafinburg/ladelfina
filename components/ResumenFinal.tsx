'use client';

import { useState } from 'react';
import type { OrdenCompra, ItemMatcheado, RespuestaCrearPedido } from '@/types';

interface ResumenFinalProps {
  orden: OrdenCompra;
  itemsMatcheados: ItemMatcheado[];
  onCargar: (ordenEditada: OrdenCompra, itemsEditados: ItemMatcheado[]) => void;
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
  // Estado local editable — copia de los datos originales
  const [cabecera, setCabecera] = useState<OrdenCompra>({ ...orden });
  const [items, setItems] = useState<ItemMatcheado[]>(
    itemsMatcheados.map((im) => ({ ...im, itemOriginal: { ...im.itemOriginal } })),
  );
  const [modoEdicion, setModoEdicion] = useState(false);

  const totalCalculado = items.reduce(
    (sum, im) =>
      sum + im.itemOriginal.cantidad * (im.itemOriginal.precioUnitario ?? im.productoSeleccionado?.PrecioVenta ?? 0),
    0,
  );

  const actualizarItem = (
    idx: number,
    campo: 'cantidad' | 'precioUnitario',
    valor: number,
  ) => {
    setItems((prev) =>
      prev.map((im, i) =>
        i === idx
          ? { ...im, itemOriginal: { ...im.itemOriginal, [campo]: valor } }
          : im,
      ),
    );
  };

  const eliminarItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleCargar = () => {
    // Armar la orden editada con los ítems corregidos
    const ordenEditada: OrdenCompra = {
      ...cabecera,
      items: items.map((im) => im.itemOriginal),
      total: totalCalculado,
    };
    onCargar(ordenEditada, items);
  };

  // ── Pantalla de éxito ─────────────────────────────────────────
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
          <p className="text-gray-500 mt-1">La orden fue registrada en Contabilium</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl px-8 py-5 text-center">
          <p className="text-sm text-gray-500">Número de pedido</p>
          <p className="text-4xl font-black text-blue-600 mt-1">
            {resultado.Numero ?? resultado.Id}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            OC: {cabecera.numeroOrden} — {cabecera.nombreCliente}
          </p>
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

  // ── Campos editables helper ───────────────────────────────────
  const Campo = ({
    label,
    campo,
    tipo = 'text',
  }: {
    label: string;
    campo: keyof OrdenCompra;
    tipo?: string;
  }) => (
    <div>
      <span className="text-gray-400 block text-xs mb-0.5">{label}</span>
      {modoEdicion ? (
        <input
          type={tipo}
          value={String(cabecera[campo] ?? '')}
          onChange={(e) => setCabecera((p) => ({ ...p, [campo]: e.target.value }))}
          className="w-full text-sm font-semibold border border-blue-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50"
        />
      ) : (
        <span className="font-semibold text-sm">{String(cabecera[campo] || '—')}</span>
      )}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Barra de edición */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-5 py-3">
        <p className="text-sm text-gray-600">
          {modoEdicion ? (
            <span className="text-blue-700 font-medium">✏️ Modo edición activo — modificá los datos antes de cargar</span>
          ) : (
            <span className="text-gray-500">Revisá el resumen. Podés editar los datos antes de cargar.</span>
          )}
        </p>
        <button
          onClick={() => setModoEdicion((v) => !v)}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
            modoEdicion
              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              : 'bg-white text-blue-600 border-blue-300 hover:bg-blue-50'
          }`}
        >
          {modoEdicion ? '✓ Listo' : '✏️ Editar datos'}
        </button>
      </div>

      {/* Datos del pedido */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">
          Datos del pedido
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Campo label="Cliente" campo="nombreCliente" />
          <Campo label="CUIT" campo="cuit" />
          <Campo label="N° OC" campo="numeroOrden" />
          <Campo label="Fecha emisión" campo="fechaEmision" tipo="date" />
          <Campo label="Fecha entrega" campo="fechaEntrega" tipo="date" />
          <Campo label="Condición de pago" campo="condicionPago" />
          <div className="col-span-2 md:col-span-3">
            <Campo label="Dirección de entrega" campo="direccionEntrega" />
          </div>
        </div>
      </div>

      {/* Tabla de ítems */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">
            Ítems ({items.length})
          </h3>
          {modoEdicion && (
            <span className="text-xs text-blue-500">Editá cantidad y precio directamente en la tabla</span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Producto</th>
                <th className="text-left py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Código</th>
                <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Cantidad</th>
                <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Precio unit.</th>
                <th className="text-right py-2 px-4 text-xs font-semibold text-gray-500 uppercase">Subtotal</th>
                {modoEdicion && (
                  <th className="py-2 px-4 text-xs font-semibold text-gray-500 uppercase" />
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {items.map((im, idx) => {
                const precio =
                  im.itemOriginal.precioUnitario ?? im.productoSeleccionado?.PrecioVenta ?? 0;
                const cantidad = im.itemOriginal.cantidad;
                const subtotal = cantidad * precio;

                return (
                  <tr key={im.itemOriginal.id} className={modoEdicion ? 'bg-blue-50/30' : 'hover:bg-gray-50/50'}>
                    <td className="py-2.5 px-4">
                      <p className="font-medium">
                        {im.productoSeleccionado?.Descripcion ?? im.itemOriginal.descripcion}
                      </p>
                      <p className="text-xs text-gray-400">{im.itemOriginal.descripcion}</p>
                    </td>
                    <td className="py-2.5 px-4 text-gray-500 font-mono text-xs">
                      {im.productoSeleccionado?.Codigo ?? '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {modoEdicion ? (
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={cantidad}
                          onChange={(e) =>
                            actualizarItem(idx, 'cantidad', Number(e.target.value))
                          }
                          className="w-20 text-right border border-blue-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                        />
                      ) : (
                        <span>{cantidad} {im.itemOriginal.unidad}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {modoEdicion ? (
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={precio}
                          onChange={(e) =>
                            actualizarItem(idx, 'precioUnitario', Number(e.target.value))
                          }
                          className="w-28 text-right border border-blue-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                        />
                      ) : (
                        <span>${precio.toLocaleString('es-AR')}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold">
                      ${subtotal.toLocaleString('es-AR')}
                    </td>
                    {modoEdicion && (
                      <td className="py-2.5 px-2">
                        <button
                          onClick={() => eliminarItem(idx)}
                          title="Eliminar ítem"
                          className="text-red-400 hover:text-red-600 p-1 rounded transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={modoEdicion ? 5 : 4} className="py-3 px-4 text-right font-bold text-sm">
                  Total del pedido
                </td>
                <td className="py-3 px-4 text-right font-black text-base">
                  ${totalCalculado.toLocaleString('es-AR')}
                </td>
                {modoEdicion && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Observaciones */}
      {modoEdicion && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <label className="text-sm font-bold text-gray-500 uppercase tracking-wide block mb-2">
            Observaciones
          </label>
          <textarea
            rows={2}
            value={cabecera.condicionPago ?? ''}
            placeholder="Notas internas para el pedido..."
            onChange={(e) => setCabecera((p) => ({ ...p, observaciones: e.target.value }))}
            className="w-full text-sm border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50 resize-none"
          />
        </div>
      )}

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
          onClick={handleCargar}
          disabled={cargando || modoEdicion || items.length === 0}
          title={modoEdicion ? 'Cerrá el modo edición antes de cargar' : ''}
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
              {modoEdicion ? 'Cerrá edición para cargar' : 'Cargar orden en Contabilium'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
