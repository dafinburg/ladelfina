'use client';

import { useState, useEffect } from 'react';
import type { ItemMatcheado, ProductoContabilium, OrdenCompra } from '@/types';

interface TablaMatchingProps {
  orden: OrdenCompra;
  itemsMatcheados: ItemMatcheado[];
  onActualizar: (items: ItemMatcheado[]) => void;
  onConfirmar: () => void;
  onVolver: () => void;
  cargando: boolean;
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 80 ? 'bg-green-100 text-green-700 border-green-200' :
    pct >= 50 ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
    'bg-red-100 text-red-700 border-red-200';

  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {pct}%
    </span>
  );
}

interface ProductoSelectorProps {
  productos: ProductoContabilium[];
  seleccionado: ProductoContabilium | null;
  onSeleccionar: (p: ProductoContabilium | null) => void;
}

function ProductoSelector({ productos, seleccionado, onSeleccionar }: ProductoSelectorProps) {
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState(false);

  const filtrados = busqueda.length >= 2
    ? productos.filter((p) =>
        p.Descripcion.toLowerCase().includes(busqueda.toLowerCase()) ||
        p.Codigo.toLowerCase().includes(busqueda.toLowerCase())
      ).slice(0, 20)
    : [];

  return (
    <div className="relative">
      <input
        type="text"
        value={busqueda || seleccionado?.Descripcion || ''}
        onChange={(e) => { setBusqueda(e.target.value); setAbierto(true); }}
        onFocus={() => { setBusqueda(''); setAbierto(true); }}
        onBlur={() => setTimeout(() => setAbierto(false), 200)}
        placeholder="Buscar producto..."
        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {abierto && filtrados.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtrados.map((p) => (
            <button
              key={p.Id}
              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 flex flex-col gap-0.5"
              onMouseDown={() => { onSeleccionar(p); setBusqueda(''); setAbierto(false); }}
            >
              <span className="font-medium text-gray-800">{p.Descripcion}</span>
              <span className="text-xs text-gray-500">{p.Codigo} — ${p.PrecioVenta.toLocaleString('es-AR')}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TablaMatching({
  orden,
  itemsMatcheados,
  onActualizar,
  onConfirmar,
  onVolver,
  cargando,
}: TablaMatchingProps) {
  const [productos, setProductos] = useState<ProductoContabilium[]>([]);
  const [loadingProductos, setLoadingProductos] = useState(true);
  const [errorProductos, setErrorProductos] = useState<string | null>(null);

  useEffect(() => {
    // Cargar productos desde Google Sheets via el endpoint de sincronización
    fetch('/api/productos')
      .then((r) => r.json())
      .then((data) => {
        if (data.productos) setProductos(data.productos);
        else setErrorProductos(data.error ?? 'Error cargando productos');
      })
      .catch((e) => setErrorProductos(e.message))
      .finally(() => setLoadingProductos(false));
  }, []);

  const updateItem = (idx: number, update: Partial<ItemMatcheado>) => {
    onActualizar(
      itemsMatcheados.map((item, i) =>
        i === idx ? { ...item, ...update } : item
      )
    );
  };

  const todosConfirmados = itemsMatcheados.every(
    (im) => im.productoSeleccionado !== null && im.estado !== 'pendiente'
  );

  const pendientes = itemsMatcheados.filter((im) => im.estado === 'pendiente').length;

  return (
    <div className="space-y-4">
      {/* Header con estadísticas */}
      <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
        <div className="flex-1">
          <p className="text-sm text-blue-800 font-medium">
            Revisá el matching automático de productos. Podés corregir cualquier asignación antes de continuar.
          </p>
        </div>
        <div className="flex gap-3 text-center shrink-0">
          <div className="bg-white rounded-lg px-4 py-2 border border-blue-200">
            <p className="text-xl font-bold text-green-600">
              {itemsMatcheados.filter((im) => im.estado === 'aceptado' || im.estado === 'corregido').length}
            </p>
            <p className="text-xs text-gray-500">Confirmados</p>
          </div>
          <div className="bg-white rounded-lg px-4 py-2 border border-blue-200">
            <p className="text-xl font-bold text-orange-500">{pendientes}</p>
            <p className="text-xs text-gray-500">Pendientes</p>
          </div>
        </div>
      </div>

      {/* Error cargando productos */}
      {errorProductos && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <strong>Advertencia:</strong> {errorProductos}. Sincronice los maestros en el menú &quot;Maestros&quot; primero.
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Producto del cliente</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase w-8">→</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-gray-500 uppercase">Producto sistema</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase w-20">Match</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-gray-500 uppercase w-24">Cant.</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-gray-500 uppercase w-28">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {itemsMatcheados.map((im, idx) => (
                <tr
                  key={im.itemOriginal.id}
                  className={`hover:bg-gray-50/50 ${
                    im.alertaPrecio ? 'bg-amber-50/30' : ''
                  }`}
                >
                  {/* Producto cliente */}
                  <td className="py-3 px-4">
                    <p className="font-medium text-gray-800">{im.itemOriginal.descripcion}</p>
                    {im.itemOriginal.codigoCliente && (
                      <p className="text-xs text-gray-400 mt-0.5">Cód: {im.itemOriginal.codigoCliente}</p>
                    )}
                    {im.itemOriginal.precioUnitario && (
                      <p className="text-xs text-gray-400">Precio cliente: ${im.itemOriginal.precioUnitario.toLocaleString('es-AR')}</p>
                    )}
                  </td>

                  {/* Flecha */}
                  <td className="py-3 px-4 text-center">
                    <span className="text-gray-300 text-lg">→</span>
                  </td>

                  {/* Selector de producto sistema */}
                  <td className="py-3 px-4">
                    {loadingProductos ? (
                      <div className="h-8 bg-gray-100 rounded animate-pulse" />
                    ) : (
                      <div className="space-y-1">
                        <ProductoSelector
                          productos={productos}
                          seleccionado={im.productoSeleccionado}
                          onSeleccionar={(p) =>
                            updateItem(idx, {
                              productoSeleccionado: p,
                              estado: p ? 'corregido' : 'pendiente',
                            })
                          }
                        />
                        {im.productoSeleccionado && (
                          <p className="text-xs text-gray-500">
                            Cód: {im.productoSeleccionado.Codigo} —{' '}
                            <span className={im.alertaPrecio ? 'text-amber-600 font-semibold' : ''}>
                              ${im.productoSeleccionado.PrecioVenta.toLocaleString('es-AR')}
                            </span>
                          </p>
                        )}
                        {im.alertaPrecio && im.diferenciaPrecio !== null && (
                          <div className="flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                            <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                            </svg>
                            Diferencia de precio: {im.diferenciaPrecio}%
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Score */}
                  <td className="py-3 px-4 text-center">
                    <ScoreBadge score={im.scoreConfianza} />
                  </td>

                  {/* Cantidad */}
                  <td className="py-3 px-4 text-right font-medium">
                    {im.itemOriginal.cantidad} {im.itemOriginal.unidad}
                  </td>

                  {/* Estado */}
                  <td className="py-3 px-4 text-center">
                    {im.estado === 'aceptado' || im.estado === 'corregido' ? (
                      <button
                        onClick={() => updateItem(idx, { estado: 'pendiente' })}
                        className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full border border-green-200 hover:bg-green-200 transition-colors font-medium"
                      >
                        Confirmado
                      </button>
                    ) : im.estado === 'sin-match' ? (
                      <span className="text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded-full border border-red-200 font-medium">
                        Sin match
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          if (!im.productoSeleccionado) {
                            if (im.productoSugerido) {
                              updateItem(idx, {
                                productoSeleccionado: im.productoSugerido,
                                estado: 'aceptado',
                              });
                            }
                          } else {
                            updateItem(idx, { estado: 'aceptado' });
                          }
                        }}
                        disabled={!im.productoSugerido && !im.productoSeleccionado}
                        className="text-xs px-2.5 py-1 bg-orange-100 text-orange-700 rounded-full border border-orange-200 hover:bg-orange-200 transition-colors font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Pendiente
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Acciones */}
      <div className="flex justify-between">
        <button
          onClick={onVolver}
          className="px-5 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Volver
        </button>
        <button
          onClick={onConfirmar}
          disabled={!todosConfirmados || cargando}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pendientes > 0
            ? `Falta confirmar ${pendientes} ítem${pendientes > 1 ? 's' : ''}`
            : 'Ver resumen y cargar'
          }
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
