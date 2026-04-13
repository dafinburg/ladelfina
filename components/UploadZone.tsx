'use client';

import { useState, useCallback } from 'react';
import type { OrdenCompra } from '@/types';

interface UploadZoneProps {
  onExtracted: (orden: OrdenCompra) => void;
  onError: (msg: string) => void;
  cargando: boolean;
  setCargando: (v: boolean) => void;
}

export function UploadZone({ onExtracted, onError, cargando, setCargando }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [archivoNombre, setArchivoNombre] = useState<string | null>(null);

  const processFile = useCallback(
    async (file: File) => {
      const allowedTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
      ];
      const allowedExts = ['.pdf', '.xlsx', '.xls'];
      const ext = '.' + file.name.split('.').pop()?.toLowerCase();

      if (!allowedExts.includes(ext)) {
        onError('Tipo de archivo no soportado. Use PDF o Excel (.xlsx, .xls)');
        return;
      }

      setArchivoNombre(file.name);
      setCargando(true);

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/extraer', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? 'Error al procesar el archivo');
        }

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

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  return (
    <div className="w-full max-w-2xl mx-auto">
      <label
        className={`
          flex flex-col items-center justify-center w-full h-64
          border-2 border-dashed rounded-xl cursor-pointer
          transition-all duration-200
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
          onChange={handleChange}
          disabled={cargando}
        />

        {cargando ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">
              Procesando <span className="font-medium">{archivoNombre}</span>...
            </p>
            <p className="text-xs text-gray-400">
              {archivoNombre?.endsWith('.pdf')
                ? 'Analizando con IA (puede demorar unos segundos)'
                : 'Extrayendo datos del Excel...'}
            </p>
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
                PDF o Excel (.xlsx, .xls) — Órdenes de compra de clientes
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
    </div>
  );
}
