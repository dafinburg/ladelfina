import { NextRequest, NextResponse } from 'next/server';
import { crearPedido, getClientePorCuit } from '@/lib/contabilium';
import { getSheetRows, appendSheetRows } from '@/lib/googleSheets';
import type {
  OrdenCompra,
  ItemMatcheado,
  PedidoContabiliumPayload,
  ClienteContabilium,
} from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface CargarOrdenBody {
  orden: OrdenCompra;
  itemsMatcheados: ItemMatcheado[];
}

export async function POST(req: NextRequest) {
  try {
    const body: CargarOrdenBody = await req.json();
    const { orden, itemsMatcheados } = body;

    if (!orden || !itemsMatcheados?.length) {
      return NextResponse.json({ error: 'Datos de orden incompletos' }, { status: 400 });
    }

    // ── 1. Buscar cliente por CUIT en Google Sheets ──────────────
    const clientes = await getSheetRows<Record<string, string>>('Clientes');

    const cuitNorm = orden.cuit.replace(/[^0-9]/g, '');
    const clienteRow = clientes.find(
      (c) => (c['CUIT'] ?? '').replace(/[^0-9]/g, '') === cuitNorm,
    );

    let clienteId: number;

    if (clienteRow?.['ID']) {
      clienteId = Number(clienteRow['ID']);
    } else {
      // Intentar buscar directamente en Contabilium
      const clienteContabilium: ClienteContabilium | null = await getClientePorCuit(orden.cuit);
      if (!clienteContabilium) {
        return NextResponse.json(
          {
            error: `No se encontró el cliente con CUIT ${orden.cuit} en el sistema. Sincronice los maestros primero.`,
          },
          { status: 404 },
        );
      }
      clienteId = clienteContabilium.Id;
    }

    // ── 2. Validar que todos los ítems estén matcheados ──────────
    const itemsSinMatch = itemsMatcheados.filter((im) => !im.productoSeleccionado);
    if (itemsSinMatch.length > 0) {
      return NextResponse.json(
        {
          error: `Hay ${itemsSinMatch.length} ítem(s) sin producto asignado. Complete el matching antes de cargar.`,
          itemsSinMatch: itemsSinMatch.map((im) => im.itemOriginal.descripcion),
        },
        { status: 400 },
      );
    }

    // ── 3. Construir payload del pedido ───────────────────────────
    const payload: PedidoContabiliumPayload = {
      ClienteId: clienteId,
      Fecha: orden.fechaEmision,
      FechaEntrega: orden.fechaEntrega,
      Observaciones: `OC ${orden.numeroOrden} - ${orden.nombreCliente}`,
      Items: itemsMatcheados.map((im) => ({
        ConceptoId: im.productoSeleccionado!.Id,
        Descripcion: im.productoSeleccionado!.Descripcion,
        Cantidad: im.itemOriginal.cantidad,
        Precio: im.productoSeleccionado!.PrecioVenta,
        Descuento: 0,
      })),
    };

    // ── 4. Crear pedido en Contabilium ────────────────────────────
    const respuesta = await crearPedido(payload);

    // ── 5. Registrar en historial de Google Sheets ────────────────
    const total = orden.total ?? itemsMatcheados.reduce(
      (sum, im) => sum + im.itemOriginal.cantidad * (im.productoSeleccionado?.PrecioVenta ?? 0),
      0,
    );

    await appendSheetRows('Historial', [[
      new Date().toISOString(),
      orden.numeroOrden,
      orden.nombreCliente,
      total,
      String(respuesta.Numero ?? respuesta.Id),
    ]]);

    return NextResponse.json({
      ok: true,
      pedido: respuesta,
      mensaje: `Pedido ${respuesta.Numero ?? respuesta.Id} creado exitosamente en Contabilium`,
    });
  } catch (err) {
    console.error('[/api/cargar-orden] Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error desconocido al cargar la orden' },
      { status: 500 },
    );
  }
}
