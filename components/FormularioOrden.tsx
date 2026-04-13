'use client';

import { useState } from 'react';
import type { OrdenCompra, ItemOrden } from '@/types';

interface FormularioOrdenProps {
  orden: OrdenCompra;
  onConfirmar: (orden: OrdenCompra) => void;
  onVolver: () => void;
}

function InputField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string | number | null;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
      />
    </div>
  );
}

export function FormularioOrden({ orden: initialOrden, onConfirmar, onVolver }: FormularioOrdenProps) {
  const [orden, setOrden] = useState<OrdenCompra>(initialOrden);

  const updateCabecera = (field: keyof OrdenCompra, value: string | number | null) => {
    setOrden((prev) => ({ ...prev, [field]: value }));
  };

  const updateItem = (idx: number, field: keyof ItemOrden, value: string | number | null) => {
    setOrden((prev) => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...prev, items };
    });
  };

  const addItem = () => {
    setOrden((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          id: String(Date.now()),
          codigoCliente: '',
          descripcion: '',
          cantidad: 1,
          unidad: 'UN',
          precioUnitario: null,
          importeTotal: null,
        },
      ],
    }));
  };

  const removeItem = (idx: number) => {
    setOrden((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== idx),
    }));
  };

  const handleConfirmar = () => {
    if (orden.items.length === 0) {
      alert('La orden debe tener al menos un ítem');
      return;
    }
    const sinDescripcion = orden.items.find((i) => !i.descripcion.trim());
    if (sinDescripcion) {
      alert('Todos los ítems deben tener descripción');
      return;
    }
    onConfirmar(orden);
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full inline-block" />
          Datos de la orden
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <InputField
            label="N° de orden"
            value={orden.numeroOrden}
            onChange={(v) => updateCabecera('numeroOrden', v)}
          />
          <InputField
            label="Fecha de emisión"
            value={orden.fechaEmision}
            onChange={(v) => updateCabecera('fechaEmision', v)}
            type="date"
          />
          <InputField
            label="Fecha de entrega"
            value={orden.fechaEntrega}
            onChange={(v) => updateCabecera('fechaEntrega', v)}
            type="date"
          />
          <InputField
            label="Cliente"
            value={orden.nombreCliente}
            onChange={(v) => updateCabecera('nombreCliente', v)}
          />
          <InputField
            label="CUIT"
            value={orden.cuit}
            onChange={(v) => updateCabecera('cuit', v)}
          />
          <InputField
            label="Condición de pago"
            value={orden.condicionPago}
            onChange={(v) => updateCabecera('condicionPago', v)}
          />
          <div className="sm:col-span-2 lg:col-span-3">
            <InputField
              label="Dirección de entrega"
              value={orden.direccionEntrega}
              onChange={(v) => updateCabecera('direccionEntrega', v)}
            />
          </div>
        </div>
      </div>

      {/* Tabla de ítems */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
            Ítems de la orden
            <span className="text-sm font-normal text-gray-400">({orden.items.length} productos)</span>
          </h2>
          <button
            onClick={addItem}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Agregar ítem
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-100">
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase w-24">Cód. cliente</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase">Descripción</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase w-20">Cant.</th>
                <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase w-20">Unidad</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase w-28">Precio unit.</th>
                <th className="text-right py-2 px-2 text-xs font-semibold text-gray-500 uppercase w-28">Importe</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {orden.items.map((item, idx) => (
                <tr key={item.id} className="border-b border-gray-50 hover:bg-gray-50/50 group">
                  <td className="py-1.5 px-2">
                    <input
                      type="text"
                      value={item.codigoCliente}
                      onChange={(e) => updateItem(idx, 'codigoCliente', e.target.value)}
                      className="w-full px-2 py-1 border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white text-sm"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="text"
                      value={item.descripcion}
                      onChange={(e) => updateItem(idx, 'descripcion', e.target.value)}
                      className="w-full px-2 py-1 border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white text-sm font-medium"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      value={item.cantidad}
                      onChange={(e) => updateItem(idx, 'cantidad', Number(e.target.value))}
                      min={0}
                      className="w-full px-2 py-1 border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white text-sm text-right"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="text"
                      value={item.unidad}
                      onChange={(e) => updateItem(idx, 'unidad', e.target.value)}
                      className="w-full px-2 py-1 border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white text-sm text-center"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      value={item.precioUnitario ?? ''}
                      onChange={(e) => updateItem(idx, 'precioUnitario', e.target.value ? Number(e.target.value) : null)}
                      placeholder="—"
                      step="0.01"
                      className="w-full px-2 py-1 border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white text-sm text-right"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <input
                      type="number"
                      value={item.importeTotal ?? ''}
                      onChange={(e) => updateItem(idx, 'importeTotal', e.target.value ? Number(e.target.value) : null)}
                      placeholder="—"
                      step="0.01"
                      className="w-full px-2 py-1 border border-transparent rounded focus:border-blue-300 focus:outline-none focus:bg-white text-sm text-right"
                    />
                  </td>
                  <td className="py-1.5 px-2">
                    <button
                      onClick={() => removeItem(idx)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                      title="Eliminar ítem"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
              {orden.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400 text-sm">
                    No hay ítems. Hacé clic en &quot;Agregar ítem&quot; para añadir productos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        {(orden.subtotal !== null || orden.total !== null) && (
          <div className="mt-4 flex justify-end">
            <div className="space-y-1 text-sm min-w-48">
              {orden.subtotal !== null && (
                <div className="flex justify-between gap-8">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">${orden.subtotal.toLocaleString('es-AR')}</span>
                </div>
              )}
              {orden.iva !== null && (
                <div className="flex justify-between gap-8">
                  <span className="text-gray-500">IVA</span>
                  <span className="font-medium">${orden.iva.toLocaleString('es-AR')}</span>
                </div>
              )}
              {orden.total !== null && (
                <div className="flex justify-between gap-8 border-t pt-1 font-bold text-base">
                  <span>Total</span>
                  <span>${orden.total.toLocaleString('es-AR')}</span>
                </div>
              )}
            </div>
          </div>
        )}
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
          onClick={handleConfirmar}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          Continuar al matching
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
