/**
 * Google Apps Script — La Delfina Sheets API
 *
 * Deploy como Web App:
 *   - Ejecutar como: Yo (diegofainburg@...)
 *   - Quién puede acceder: Cualquier persona
 *
 * Variables a configurar en Archivo > Propiedades del proyecto:
 *   APPS_SCRIPT_SECRET = (el mismo valor que ponés en Vercel)
 */

var SPREADSHEET_ID = '12pdXdvt42MbXUk5ftAGoT3zSpMCXahSrSmODtTrQbJc';

// ── Entry point POST ──────────────────────────────────────────

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    // Verificar token secreto
    var secret = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SECRET');
    if (!secret || body.token !== secret) {
      return jsonResponse({ ok: false, error: 'Unauthorized' }, 401);
    }

    var action = body.action;
    var data   = body.data;
    var sheet  = body.sheet;

    if (action === 'write') {
      writeSheet(sheet, data);
      return jsonResponse({ ok: true, rows: data.length - 1 });
    }

    if (action === 'read') {
      var rows = readSheet(sheet);
      return jsonResponse({ ok: true, rows: rows });
    }

    if (action === 'setup') {
      setupSheets();
      return jsonResponse({ ok: true, message: 'Hojas creadas/verificadas' });
    }

    return jsonResponse({ ok: false, error: 'Acción desconocida: ' + action });

  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

// ── Entry point GET (health check) ───────────────────────────

function doGet(e) {
  var secret = PropertiesService.getScriptProperties().getProperty('APPS_SCRIPT_SECRET');
  var ok = !!secret;
  return jsonResponse({ ok: ok, status: ok ? 'La Delfina Sheets API lista' : 'Falta configurar APPS_SCRIPT_SECRET' });
}

// ── Escribir hoja (limpia y reescribe) ────────────────────────

function writeSheet(sheetName, data) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clearContents();
  }

  if (!data || data.length === 0) return;

  var range = sheet.getRange(1, 1, data.length, data[0].length);
  range.setValues(data);

  // Encabezados en negrita y fondo azul
  var headerRange = sheet.getRange(1, 1, 1, data[0].length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#1a56db');
  headerRange.setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  // Autoajustar columnas
  for (var i = 1; i <= data[0].length; i++) {
    sheet.autoResizeColumn(i);
  }
}

// ── Leer hoja ─────────────────────────────────────────────────

function readSheet(sheetName) {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) return [];

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2) return []; // Solo encabezados o vacío

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var dataRows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return dataRows.map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      obj[h] = row[i];
    });
    return obj;
  });
}

// ── Setup inicial de hojas ────────────────────────────────────

function setupSheets() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  var sheets = {
    'Clientes':  [['ID', 'Razón Social', 'CUIT', 'Condición IVA', 'Email', 'Teléfono']],
    'Productos': [['ID', 'Código', 'Descripción', 'Precio Venta', 'Unidad']],
    'Historial': [['Fecha Carga', 'N° OC', 'Cliente', 'Total', 'N° Pedido']]
  };

  Object.keys(sheets).forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    var headers = sheets[name][0];
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#1a56db');
    headerRange.setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  });
}

// ── Helper JSON response ──────────────────────────────────────

function jsonResponse(data, statusCode) {
  var output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
