'use client';

import { useState, useCallback, useRef } from 'react';

interface FilaProducto {
  id: number;
  nombre: string;
  codigo: string;
  porFecha: Record<string, number>;
  total: number;
  cantOrdenes: number;
}

interface TableroData {
  desde: string;
  hasta: string;
  fechas: string[];
  rows: FilaProducto[];
  totalOrdenes: number;
  allTags: string[];
  filtroTags: string[];
}

function formatFecha(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function formatFechaLarga(iso: string): string {
  const [y, m, d] = iso.split('-');
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dia = dias[new Date(iso).getDay()];
  return `${dia} ${d}/${m}`;
}

export default function TableroComandasPage() {
  const hoy = new Date().toISOString().split('T')[0];
  const en30 = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(en30);
  const [tagsFiltro, setTagsFiltro] = useState<string[]>([]);
  const [data, setData] = useState<TableroData | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const params = new URLSearchParams({ desde, hasta });
      if (tagsFiltro.length > 0) params.set('tags', tagsFiltro.join(','));
      const res = await fetch(`/api/tablero?${params}`);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? 'Error al cargar el tablero');
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setCargando(false);
    }
  }, [desde, hasta, tagsFiltro]);

  const toggleTag = (tag: string) => {
    setTagsFiltro((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  // ── Export Excel ──────────────────────────────────────────────
  const exportarExcel = useCallback(async () => {
    if (!data) return;
    const XLSX = await import('xlsx');

    // Encabezados
    const headers = [
      'Código', 'Producto', 'N° Órdenes',
      ...data.fechas.map(formatFechaLarga),
      'TOTAL',
    ];

    // Filas
    const filas = data.rows.map((row) => [
      row.codigo,
      row.nombre,
      row.cantOrdenes,
      ...data.fechas.map((f) => row.porFecha[f] ?? 0),
      row.total,
    ]);

    // Fila de totales por fecha
    const totalesPorFecha = data.fechas.map((f) =>
      data.rows.reduce((s, r) => s + (r.porFecha[f] ?? 0), 0),
    );
    const totalGeneral = data.rows.reduce((s, r) => s + r.total, 0);
    const filaTotales = ['', 'TOTAL', '', ...totalesPorFecha, totalGeneral];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...filas, filaTotales]);

    // Anchos de columna
    ws['!cols'] = [
      { wch: 10 }, { wch: 30 }, { wch: 12 },
      ...data.fechas.map(() => ({ wch: 12 })),
      { wch: 10 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tablero de Comandas');
    XLSX.writeFile(wb, `tablero-comandas-${desde}-${hasta}.xlsx`);
  }, [data, desde, hasta]);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
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
            <a href="/" className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Nueva orden</a>
            <a href="/tablero" className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg">Tablero</a>
            <a href="/maestros" className="px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Maestros</a>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {/* Título */}
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Tablero de Comandas</h2>
          <p className="text-gray-500 text-sm mt-1">
            Producción requerida por día según órdenes de venta pendientes
          </p>
        </div>

        {/* Filtros */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap gap-4 items-end">
            {/* Fecha desde */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                Fecha desde
              </label>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Fecha hasta */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">
                Fecha hasta
              </label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {/* Botón actualizar */}
            <button
              onClick={fetchData}
              disabled={cargando}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cargando ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Actualizando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Actualizar
                </>
              )}
            </button>

            {/* Export Excel */}
            {data && data.rows.length > 0 && (
              <button
                onClick={exportarExcel}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Descargar Excel
              </button>
            )}
          </div>

          {/* Filtro de Tags */}
          {data && data.allTags.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">
                Categorías (Tags) — seleccioná una o más, o dejá vacío para ver todas
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTagsFiltro([])}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    tagsFiltro.length === 0
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  }`}
                >
                  Todos
                </button>
                {data.allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                      tagsFiltro.includes(tag)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-sm">
            <p className="font-semibold">Error al cargar el tablero:</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* Stats */}
        {data && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-black text-blue-600">{data.totalOrdenes}</p>
              <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">Órdenes de venta</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-black text-blue-600">{data.rows.length}</p>
              <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">Productos distintos</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-3xl font-black text-blue-600">
                {data.rows.reduce((s, r) => s + r.total, 0).toLocaleString('es-AR')}
              </p>
              <p className="text-xs text-gray-500 mt-1 font-medium uppercase tracking-wide">Unidades totales</p>
            </div>
          </div>
        )}

        {/* Tabla pivot */}
        {data && data.rows.length > 0 && (
          <div ref={tableRef} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-700">
                Producción requerida — {data.desde} al {data.hasta}
                {data.filtroTags.length > 0 && (
                  <span className="ml-2 text-blue-600">
                    · Tags: {data.filtroTags.join(', ')}
                  </span>
                )}
              </h3>
              <span className="text-xs text-gray-400">{data.fechas.length} días con órdenes</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="text-left py-3 px-4 font-semibold sticky left-0 bg-gray-800 z-10 min-w-[200px]">
                      Producto
                    </th>
                    <th className="text-left py-3 px-3 font-semibold text-gray-300 text-xs">
                      Cód.
                    </th>
                    {data.fechas.map((f) => (
                      <th key={f} className="text-center py-3 px-3 font-semibold min-w-[80px]">
                        <div className="text-xs text-gray-300">
                          {new Date(f).toLocaleDateString('es-AR', { weekday: 'short' })}
                        </div>
                        <div>{formatFecha(f)}</div>
                      </th>
                    ))}
                    <th className="text-center py-3 px-4 font-bold bg-blue-700 min-w-[80px]">
                      TOTAL
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.rows.map((row, i) => (
                    <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                      <td className={`py-3 px-4 font-medium sticky left-0 z-10 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <div className="font-semibold text-gray-800">{row.nombre}</div>
                        <div className="text-xs text-gray-400">{row.cantOrdenes} orden{row.cantOrdenes !== 1 ? 'es' : ''}</div>
                      </td>
                      <td className="py-3 px-3 text-gray-400 font-mono text-xs">{row.codigo}</td>
                      {data.fechas.map((f) => {
                        const val = row.porFecha[f] ?? 0;
                        return (
                          <td key={f} className="py-3 px-3 text-center">
                            {val > 0 ? (
                              <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-full text-sm font-bold ${
                                val >= 10 ? 'bg-red-100 text-red-700' :
                                val >= 5 ? 'bg-orange-100 text-orange-700' :
                                'bg-blue-100 text-blue-700'
                              }`}>
                                {val}
                              </span>
                            ) : (
                              <span className="text-gray-200">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="py-3 px-4 text-center font-black text-base text-blue-700 bg-blue-50">
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Fila de totales por fecha */}
                <tfoot>
                  <tr className="bg-gray-800 text-white border-t-2 border-gray-600">
                    <td className="py-3 px-4 font-bold sticky left-0 bg-gray-800 z-10" colSpan={2}>
                      TOTAL DIARIO
                    </td>
                    {data.fechas.map((f) => {
                      const total = data.rows.reduce((s, r) => s + (r.porFecha[f] ?? 0), 0);
                      return (
                        <td key={f} className="py-3 px-3 text-center font-bold text-lg">
                          {total > 0 ? total : '—'}
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-center font-black text-lg bg-blue-700">
                      {data.rows.reduce((s, r) => s + r.total, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* Estado vacío */}
        {data && data.rows.length === 0 && !cargando && (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-gray-500 font-medium">No hay órdenes de venta para el período seleccionado</p>
            <p className="text-gray-400 text-sm mt-1">Probá cambiando el rango de fechas</p>
          </div>
        )}

        {/* Estado inicial */}
        {!data && !cargando && !error && (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium">Seleccioná el rango de fechas y hacé click en <strong>Actualizar</strong></p>
            <p className="text-gray-400 text-sm mt-1">Se cargarán las órdenes de venta pendientes del período</p>
          </div>
        )}
      </main>
    </div>
  );
}
