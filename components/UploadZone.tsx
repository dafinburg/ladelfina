'use client';

import { useState, useCallback } from 'react';
import type { OrdenCompra } from '@/types';

interface UploadZoneProps {
  onExtracted: (orden: OrdenCompra) => void;
  onError: (msg: string) => void;
  cargando: boolean;
  setCargando: (v: boolean) => void;
}

type Tab = 'archivo' | 'texto';

export function UploadZone({ onExtracted, onError, cargando, setCargando }: UploadZoneProps) {
  const [tab, setTab] = useState<Tab>('archivo');
  const [dragOver, setDragOver] = useState(false);
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);
  const [texto, setTexto] = useState('');

  // ── Procesar archivo ────────────────────────────────────────

  const processFile = useCallback(
    async (file: File) => {
      const allowedExts = ['.pdf', '.xlsx', '.xls'];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!allowedExts.includes(ext)) {
        onError('Tipo de archivo no soportado. Usá PDF o Excel (.xlsx, .xls)');
        return;
      }

      setArchivoNombre(file.name);
      setCargando(true);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/extraer', { method: 'POST', body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Error al procesar el archivo');
        onExtracted(data.orden);
      } catch (err) {
        onError(err instanceof Error ? err.message : 'Error desconocido');
        setArchivoNombre(null);
      } finally {
        setCargando(false);
      }
    },
    [onExtracted, onError, setCargando],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  // ── Procesar texto ──────────────────────────────────────────

  const handleProcesarTexto = useCallback(async () => {
    if (!texto.trim()) {
      onError('Pegá el texto de la orden antes de procesar');
      return;
    }
    setCargando(true);
    try {
      const res = await fetch('/api/extraer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: texto }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Error al procesar el texto');
      onExtracted(data.orden);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }, [texto, onExtracted, onError, setCargando]);

  // ── Render ──────────────────────────────────────────────────

  return (
    <div className="w-full max-w-2xl mx-auto space-y-3">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('archivo')}
          disabled={cargando}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            tab === 'archivo'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Subir archivo
          </span>
        </button>
        <button
          onClick={() => setTab('texto')}
          disabled={cargando}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            tab === 'texto'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Pegar texto
          </span>
        </button>
      </div>

      {/* Tab: Subir archivo */}
      {tab === 'archivo' && (
        <label
          className={`
            flex flex-col items-center justify-center w-full h-64
            border-2 border-dashed rounded-xl cursor-pointer transition-all duration-200
            ${dragOver
              ? 'border-blue-500 bg-blue-50'
              : cargando
                ? 'border-gray-300 bg-gray-50 cursor-not-allowed'
                : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50/30'
            }
          `}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            className="hidden"
            accept=".pdf,.xlsx,.xls"
            onChange={handleFileChange}
            disabled={cargando}
          />

          {cargando ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-600">
                Procesando <span className="font-medium">{archivoNombre}</span>...
              </p>
              <p className="text-xs text-gray-400">Analizando con IA, puede demorar unos segundos</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center">
                <svg className="w-7 h-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
              <div>
                <p className="text-base font-semibold text-gray-700">
                  Arrastrá el archivo o hacé clic para seleccionar
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  PDF o Excel — Órdenes de compra de clientes
                </p>
              </div>
              <div className="flex gap-2 mt-1">
                <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">PDF</span>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">XLSX</span>
                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">XLS</span>
              </div>
            </div>
          )}
        </label>
      )}

      {/* Tab: Pegar texto */}
      {tab === 'texto' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">
              Pegá el contenido de la orden de compra
            </p>
            <p className="text-xs text-gray-400">
              Copiá el texto del email, documento o cualquier fuente y pegalo acá. La IA extraerá los datos automáticamente.
            </p>
          </div>

          <textarea
            rows={12}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={cargando}
            placeholder={`Ejemplo:
Orden de Compra N° 0001-00004521
Fecha: 15/04/2026
Proveedor: Productos La Delfina SRL

Ítem  Descripción          Cantidad  Precio
1     MANTENIMIENTO        5         15.000
2     CONSULTORIA          2         25.000

Total: $125.000`}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none font-mono text-gray-700 placeholder:text-gray-300 placeholder:font-sans disabled:opacity-50 disabled:bg-gray-50"
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {texto.length > 0 ? `${texto.length} caracteres` : 'El texto mínimo es 20 caracteres'}
            </span>
            <div className="flex gap-2">
              {texto && (
                <button
                  onClick={() => setTexto('')}
                  disabled={cargando}
                  className="px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Limpiar
                </button>
              )}
              <button
                onClick={handleProcesarTexto}
                disabled={cargando || texto.trim().length < 20}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cargando ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Extraer datos con IA
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
