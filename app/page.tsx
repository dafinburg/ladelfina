'use client';

import { useState } from 'react';
import { Stepper } from '@/components/Stepper';
import { UploadZone } from '@/components/UploadZone';
import { FormularioOrden } from '@/components/FormularioOrden';
import { TablaMatching } from '@/components/TablaMatching';
import { ResumenFinal } from '@/components/ResumenFinal';
import type {
  PasoStepper,
  OrdenCompra,
  ItemMatcheado,
  RespuestaCrearPedido,
} from '@/types';

export default function HomePage() {
  const [paso, setPaso] = useState<PasoStepper>(1);
  const [orden, setOrden] = useState<OrdenCompra | null>(null);
  const [itemsMatcheados, setItemsMatcheados] = useState<ItemMatcheado[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<RespuestaCrearPedido | null>(null);

  const handleOrdenExtraida = (o: OrdenCompra) => {
    setOrden(o);
    setError(null);
    setPaso(2);
  };

  const handleOrdenConfirmada = async (o: OrdenCompra) => {
    setOrden(o);
    setCargando(true);
    setError(null);

    try {
      const res = await fetch('/api/matching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: o.items }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Error en el matching');

      setItemsMatcheados(data.itemsMatcheados);
      setPaso(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  };

  const handleMatchingConfirmado = () => {
    setPaso(4);
  };

  const handleCargarOrden = async (ordenEditada: OrdenCompra, itemsEditados: ItemMatcheado[]) => {
    if (!ordenEditada) return;
    setCargando(true);
    setError(null);
    // Actualizar estado con los datos editados
    setOrden(ordenEditada);
    setItemsMatcheados(itemsEditados);

    try {
      const res = await fetch('/api/cargar-orden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orden: ordenEditada, itemsMatcheados: itemsEditados }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Error al cargar la orden');

      setResultado(data.pedido);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  };

  const handleNuevaOrden = () => {
    setPaso(1);
    setOrden(null);
    setItemsMatcheados([]);
    setError(null);
    setResultado(null);
    setCargando(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-black text-sm">LD</span>
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-900">Productos La Delfina SRL</h1>
              <p className="text-xs text-gray-500">Sistema de órdenes de venta</p>
            </div>
          </div>
          <nav className="flex gap-1">
            <a
              href="/"
              className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg"
            >
              Nueva orden
            </a>
            <a
              href="/maestros"
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Maestros
            </a>
          </nav>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Stepper pasoActual={paso} />

        {/* Error global */}
        {error && paso !== 4 && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <div>
              <p className="font-semibold">Error</p>
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Paso 1 — Subir archivo */}
        {paso === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Subir orden de compra</h2>
              <p className="text-gray-500 text-sm mt-1">
                Subí el archivo PDF o Excel enviado por el cliente. El sistema extraerá automáticamente los datos de la orden.
              </p>
            </div>
            <UploadZone
              onExtracted={handleOrdenExtraida}
              onError={(msg) => setError(msg)}
              cargando={cargando}
              setCargando={setCargando}
            />
          </div>
        )}

        {/* Paso 2 — Revisar extracción */}
        {paso === 2 && orden && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Revisar datos extraídos</h2>
              <p className="text-gray-500 text-sm mt-1">
                Verificá y corregí los datos extraídos antes de continuar al matching de productos.
              </p>
            </div>
            {cargando ? (
              <div className="flex items-center justify-center py-12 gap-3">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-500">Procesando matching de productos...</span>
              </div>
            ) : (
              <FormularioOrden
                orden={orden}
                onConfirmar={handleOrdenConfirmada}
                onVolver={() => setPaso(1)}
              />
            )}
          </div>
        )}

        {/* Paso 3 — Matching */}
        {paso === 3 && orden && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Validar matching de productos</h2>
              <p className="text-gray-500 text-sm mt-1">
                Confirmá o corregí la asignación de productos del cliente a productos del sistema.
              </p>
            </div>
            <TablaMatching
              orden={orden}
              itemsMatcheados={itemsMatcheados}
              onActualizar={setItemsMatcheados}
              onConfirmar={handleMatchingConfirmado}
              onVolver={() => setPaso(2)}
              cargando={cargando}
            />
          </div>
        )}

        {/* Paso 4 — Cargar */}
        {paso === 4 && orden && (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Cargar orden en Contabilium</h2>
              <p className="text-gray-500 text-sm mt-1">
                Revisá el resumen final y confirmá la carga en el sistema.
              </p>
            </div>
            <ResumenFinal
              orden={orden}
              itemsMatcheados={itemsMatcheados}
              onCargar={handleCargarOrden}
              onVolver={() => setPaso(3)}
              onNuevaOrden={handleNuevaOrden}
              cargando={cargando}
              resultado={resultado}
              error={error}
            />
          </div>
        )}
      </main>
    </div>
  );
}
