'use client';

import { useState } from 'react';

interface EstadoSinc {
  clientes: { count: number; timestamp: string } | null;
  conceptos: { count: number; timestamp: string } | null;
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function MaestrosPage() {
  const [sincronizando, setSincronizando] = useState(false);
  const [estadoSinc, setEstadoSinc] = useState<EstadoSinc>({ clientes: null, conceptos: null });
  const [error, setError] = useState<string | null>(null);
  const [progreso, setProgreso] = useState<string | null>(null);

  const sincronizar = async (target: 'clientes' | 'conceptos' | 'todo') => {
    setSincronizando(true);
    setError(null);

    const mensajes: Record<string, string> = {
      clientes: 'Sincronizando clientes desde Contabilium...',
      conceptos: 'Sincronizando productos desde Contabilium...',
      todo: 'Sincronizando clientes y productos desde Contabilium...',
    };
    setProgreso(mensajes[target]);

    try {
      const res = await fetch('/api/sincronizar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error ?? 'Error desconocido');

      setEstadoSinc((prev) => ({
        clientes: data.resultado?.clientes
          ? { count: data.resultado.clientes.count, timestamp: data.resultado.clientes.timestamp }
          : prev.clientes,
        conceptos: data.resultado?.conceptos
          ? { count: data.resultado.conceptos.count, timestamp: data.resultado.conceptos.timestamp }
          : prev.conceptos,
      }));
      setProgreso(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setProgreso(null);
    } finally {
      setSincronizando(false);
    }
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
              className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Nueva orden
            </a>
            <a
              href="/maestros"
              className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg"
            >
              Maestros
            </a>
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Sincronización de maestros</h2>
          <p className="text-gray-500 text-sm mt-1">
            Sincronizá los listados de clientes y productos desde Contabilium hacia Google Sheets.
            Esto actualiza la base de datos que usa el matching de productos.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
            <p className="font-semibold">Error en la sincronización:</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* Progreso */}
        {progreso && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-sm flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin shrink-0" />
            <p>{progreso}</p>
          </div>
        )}

        {/* Cards de sincronización */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Clientes */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Clientes</h3>
                  <p className="text-xs text-gray-500">Hoja: &quot;Clientes&quot;</p>
                </div>
              </div>
              {estadoSinc.clientes && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  {estadoSinc.clientes.count} registros
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs text-gray-500 mb-4">
              <p className="flex items-center gap-1.5">
                <span className="font-medium">Columnas:</span>
                ID, Razón Social, CUIT, Condición IVA, Condición Pago
              </p>
              {estadoSinc.clientes?.timestamp && (
                <p className="flex items-center gap-1.5">
                  <span className="font-medium">Última sinc:</span>
                  {formatTimestamp(estadoSinc.clientes.timestamp)}
                </p>
              )}
            </div>

            <button
              onClick={() => sincronizar('clientes')}
              disabled={sincronizando}
              className="w-full py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sincronizar clientes
            </button>
          </div>

          {/* Productos */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-sm">Productos</h3>
                  <p className="text-xs text-gray-500">Hoja: &quot;Productos&quot;</p>
                </div>
              </div>
              {estadoSinc.conceptos && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  {estadoSinc.conceptos.count} registros
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs text-gray-500 mb-4">
              <p className="flex items-center gap-1.5">
                <span className="font-medium">Columnas:</span>
                ID, Código, Descripción, Precio Venta, Unidad
              </p>
              {estadoSinc.conceptos?.timestamp && (
                <p className="flex items-center gap-1.5">
                  <span className="font-medium">Última sinc:</span>
                  {formatTimestamp(estadoSinc.conceptos.timestamp)}
                </p>
              )}
            </div>

            <button
              onClick={() => sincronizar('conceptos')}
              disabled={sincronizando}
              className="w-full py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sincronizar productos
            </button>
          </div>
        </div>

        {/* Sincronizar todo */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-bold">Sincronizar todo</h3>
              <p className="text-blue-100 text-sm mt-0.5">
                Actualiza clientes y productos en una sola operación. Recomendado antes de cargar órdenes.
              </p>
            </div>
            <button
              onClick={() => sincronizar('todo')}
              disabled={sincronizando}
              className="shrink-0 px-5 py-2.5 bg-white text-blue-700 font-semibold rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center gap-2"
            >
              {sincronizando ? (
                <>
                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Sincronizar todo
                </>
              )}
            </button>
          </div>
        </div>

        {/* Info sobre Google Sheets */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm text-gray-600 space-y-2">
          <h4 className="font-semibold text-gray-700 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Hojas requeridas en Google Sheets
          </h4>
          <ul className="space-y-1 text-xs">
            <li><span className="font-mono bg-gray-100 px-1 rounded">Clientes</span> — Creada automáticamente al sincronizar</li>
            <li><span className="font-mono bg-gray-100 px-1 rounded">Productos</span> — Creada automáticamente al sincronizar</li>
            <li><span className="font-mono bg-gray-100 px-1 rounded">Historial</span> — Debe existir con encabezados: Fecha Carga, N° OC, Cliente, Total, N° Pedido</li>
          </ul>
          <p className="text-xs text-gray-400 mt-1">
            El spreadsheet debe estar compartido con el email del service account de Google.
          </p>
        </div>
      </main>
    </div>
  );
}
