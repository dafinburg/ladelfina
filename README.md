# Productos La Delfina SRL — Sistema de Órdenes de Venta

Web app para gestionar la recepción y carga de órdenes de compra de clientes, con extracción automática desde PDF/Excel, matching fuzzy de productos e integración con Contabilium y Google Sheets.

---

## Stack técnico

- **Frontend**: Next.js 16 (App Router) + React + Tailwind CSS
- **Backend**: API Routes de Next.js (runtime Node.js)
- **Extracción PDF**: `pdf-parse` + Claude API (`claude-sonnet-4-20250514`)
- **Extracción Excel**: `xlsx`
- **Matching de productos**: `fuse.js` (fuzzy search)
- **Integración Contabilium**: API REST con OAuth2 client credentials
- **Integración Google Sheets**: HTTP directo con Service Account JWT (sin googleapis)

---

## Setup inicial

### 1. Instalar dependencias

```bash
cd la-delfina
npm install
```

> **Nota para Windows con Google Drive**: Si el proyecto está en una carpeta de Google Drive, npm puede dar errores de escritura. Usar:
> ```bash
> npm install --cache "C:/Users/TU_USUARIO/.npm-cache-temp"
> ```
> O mover el proyecto a una ruta local como `C:\Projects\la-delfina`.

### 2. Configurar variables de entorno

```bash
cp .env.local.example .env.local
```

Editar `.env.local` con tus credenciales reales (ver tabla más abajo).

### 3. Iniciar el servidor

```bash
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000)

---

## Configuración de Google Sheets

### Crear el Spreadsheet

1. Crear un Google Spreadsheet nuevo
2. Crear estas hojas (pestañas):
   - `Clientes` — se sobreescribe al sincronizar (se crea sola)
   - `Productos` — se sobreescribe al sincronizar (se crea sola)
   - `Historial` — crear manualmente con cabeceras en fila 1:
     `Fecha Carga | N° OC | Cliente | Total | N° Pedido`
3. Copiar el ID desde la URL del spreadsheet:
   `https://docs.google.com/spreadsheets/d/**[ID_AQUI]**/edit`

### Crear el Service Account de Google

1. Ir a [Google Cloud Console](https://console.cloud.google.com/)
2. Crear o seleccionar un proyecto
3. Habilitar **Google Sheets API** (APIs & Services → Library)
4. Ir a **IAM & Admin → Service Accounts → Create Service Account**
5. Completar nombre y descripción, crear
6. En la cuenta creada: **Keys → Add Key → Create new key → JSON**
7. Descargar el archivo JSON

### Poner el JSON en `.env.local`

El JSON debe estar en **una sola línea** sin saltos de línea. En PowerShell:

```powershell
(Get-Content service-account.json -Raw) -replace "\r\n","\n" | Set-Clipboard
```

Pegar el resultado como valor de `GOOGLE_SERVICE_ACCOUNT_JSON`.

### Compartir el Spreadsheet

1. Abrir el Spreadsheet → **Compartir**
2. Agregar el `client_email` del service account (ej: `nombre@proyecto.iam.gserviceaccount.com`)
3. Dar permiso de **Editor**

---

## Configuración de Contabilium

1. Ir a [Contabilium](https://app.contabilium.com)
2. **Configuración → Integraciones → API**
3. Copiar `Client ID` y `Client Secret` al `.env.local`

---

## Flujo de uso

### Nueva orden

```
Paso 1: Subir archivo
  → Subís el PDF o Excel del cliente → extracción automática de todos los campos

Paso 2: Revisar extracción  
  → Verificás y corregís datos extraídos (cabecera + ítems editables)

Paso 3: Validar matching
  → El sistema sugiere productos del catálogo interno por similitud de descripción
  → Podés aceptar la sugerencia o buscar manualmente
  → Alertas de precio si difieren más del 1%

Paso 4: Cargar en Contabilium
  → Resumen final → botón "Cargar"
  → Se crea el pedido en Contabilium, se registra en Historial de Sheets
```

### Maestros (sincronización)

Antes del primer uso y periódicamente:
1. Ir a **Maestros** en el menú
2. Clic en **Sincronizar todo**
3. Se cargan todos los clientes y productos de Contabilium → Google Sheets

---

## Estructura de archivos

```
la-delfina/
├── app/
│   ├── page.tsx                    # Stepper principal (4 pasos)
│   ├── layout.tsx
│   ├── maestros/page.tsx           # Módulo sincronización maestros
│   └── api/
│       ├── extraer/route.ts        # POST: extrae PDF o Excel
│       ├── matching/route.ts       # POST: fuzzy match ítems → productos
│       ├── sincronizar/route.ts    # POST: sincroniza clientes/productos
│       ├── cargar-orden/route.ts   # POST: crea pedido en Contabilium
│       └── productos/route.ts      # GET: lista productos desde Sheets
├── components/
│   ├── Stepper.tsx                 # Progress bar de 4 pasos
│   ├── UploadZone.tsx              # Drop zone de archivos
│   ├── FormularioOrden.tsx         # Formulario editable de la orden
│   ├── TablaMatching.tsx           # Tabla de matching con búsqueda
│   └── ResumenFinal.tsx            # Resumen + confirmación de carga
├── lib/
│   ├── contabilium.ts              # API client con token cache y paginación
│   ├── googleSheets.ts             # Sheets via Service Account JWT
│   ├── matching.ts                 # Fuzzy search con fuse.js
│   └── extractors/
│       ├── pdf.ts                  # pdf-parse + Claude API
│       └── excel.ts                # xlsx con detección de columnas
├── types/index.ts                  # Tipos TypeScript compartidos
└── .env.local.example
```

---

## Variables de entorno

| Variable | Descripción |
|---|---|
| `CONTABILIUM_CLIENT_ID` | Client ID de Contabilium |
| `CONTABILIUM_CLIENT_SECRET` | Client Secret de Contabilium |
| `GOOGLE_SPREADSHEET_ID` | ID del Google Spreadsheet |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | JSON completo del service account (1 línea) |
| `ANTHROPIC_API_KEY` | API key de Anthropic (`sk-ant-...`) |

---

## Comandos

```bash
npm run dev      # Desarrollo en localhost:3000
npm run build    # Build de producción
npm run start    # Producción
npm run lint     # ESLint
```

---

## Notas de implementación

- **Paginación Contabilium**: La app itera todas las páginas (de a 100) automáticamente.
- **Cache de tokens**: Contabilium y Google renuevan tokens automáticamente antes de expirar.
- **Extracción IA**: Para PDFs complejos, Claude API analiza el texto y devuelve JSON estructurado.
- **Matching automático**: Score ≥ 60% → auto-aceptado; Score < 60% → pendiente de revisión manual.
- **Alerta de precio**: Se activa si el precio del cliente difiere más del 1% del precio interno.
- **Historial**: Cada carga exitosa se registra en la hoja `Historial` del Spreadsheet.
