# PROMPT PARA CLAUDE CODE — MÓDULOS 01, 03 y 07
## Hotel Management System (PMS)

---

## CONTEXTO DEL SISTEMA EXISTENTE

Estás trabajando en un sistema PMS hotelero ya en desarrollo. Lee y entiende esta estructura antes de escribir una sola línea de código.

### Stack
- **Backend**: Node.js + Express — puerto 3000
- **Frontend**: React (Vite) — puerto 5173
- **Base de datos**: PostgreSQL 15 (ORM: Sequelize)
- **Cache**: Redis
- **IA**: Python FastAPI — puerto 8001
- **Automatización**: n8n (self-hosted)
- **Pagos**: Niubiz (Perú)
- **Facturación**: SUNAT API (boleta/factura electrónica)
- **Mensajería**: WhatsApp Business API (Meta Graph API)
- **Auth**: JWT con roles (`gerente`, `recepcionista`, `housekeeping`, `mantenimiento`)

### Estructura de archivos existente
```
hotel-management-system/
├── backend/
│   └── src/
│       ├── app.js
│       ├── routes/
│       │   ├── reservas.js
│       │   ├── habitaciones.js
│       │   ├── facturacion.js
│       │   ├── huespedes.js
│       │   └── canales.js
│       ├── services/
│       │   ├── disponibilidad.js
│       │   ├── sunat.js
│       │   ├── pagos.js
│       │   └── notificaciones.js
│       └── models/
│           ├── Reserva.js
│           ├── Habitacion.js
│           ├── Huesped.js
│           ├── Folio.js
│           └── EventoMantenimiento.js
├── frontend/
│   └── src/
│       ├── components/
│       ├── pages/
│       └── services/api.js
└── ia-service/         (Python FastAPI, puerto 8001)
```

### Variables de entorno ya configuradas (.env)
```
DATABASE_URL, REDIS_URL, WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID,
NIUBIZ_MERCHANT_ID, NIUBIZ_API_KEY, SUNAT_RUC, SUNAT_USUARIO_SOL,
SUNAT_CLAVE_SOL, SUNAT_CERT_PATH, ANTHROPIC_API_KEY, N8N_WEBHOOK_URL
```

### Tabla `personal` existente (roles para middleware de auth)
```sql
CREATE TABLE personal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  rol VARCHAR(30) NOT NULL CHECK (rol IN ('gerente','recepcionista','housekeeping','mantenimiento')),
  telefono VARCHAR(20),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  ultimo_acceso TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Tabla `habitaciones` existente (base para el Módulo 07)
```sql
CREATE TABLE habitaciones (
  id VARCHAR(20) PRIMARY KEY,
  numero VARCHAR(10) NOT NULL UNIQUE,
  piso SMALLINT NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('simple','doble','triple','suite','familiar')),
  estado VARCHAR(20) NOT NULL DEFAULT 'disponible'
    CHECK (estado IN ('disponible','ocupada','limpieza','mantenimiento','bloqueada')),
  tarifa_base DECIMAL(10,2) NOT NULL,
  tarifa_minima DECIMAL(10,2) NOT NULL,
  tarifa_maxima DECIMAL(10,2) NOT NULL,
  capacidad SMALLINT NOT NULL,
  metros_cuadrados SMALLINT,
  amenities JSONB NOT NULL DEFAULT '[]',
  descripcion TEXT,
  notas_mantenimiento TEXT,
  ultima_revision DATE,
  noches_desde_revision INTEGER NOT NULL DEFAULT 0,
  fuera_de_servicio BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Tabla `huespedes` existente
```sql
CREATE TABLE huespedes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento VARCHAR(30) NOT NULL,
  numero_documento VARCHAR(20) NOT NULL,
  nombres VARCHAR(100) NOT NULL,
  apellidos VARCHAR(100) NOT NULL,
  email VARCHAR(150),
  telefono VARCHAR(20),
  segmento_crm VARCHAR(20) DEFAULT 'nuevo',
  ltv DECIMAL(12,2) DEFAULT 0,
  total_estancias INTEGER DEFAULT 0,
  gasto_total DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tipo_documento, numero_documento)
);
```

### Tabla `reservas` existente
```sql
CREATE TABLE reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habitacion_id VARCHAR(20) NOT NULL REFERENCES habitaciones(id),
  huesped_id UUID NOT NULL REFERENCES huespedes(id),
  recepcionista_id UUID REFERENCES personal(id),
  canal VARCHAR(30) NOT NULL DEFAULT 'manual_recepcion',
  estado VARCHAR(30) NOT NULL DEFAULT 'confirmada',
  fecha_entrada DATE NOT NULL,
  fecha_salida DATE NOT NULL,
  numero_noches INTEGER NOT NULL,
  numero_personas SMALLINT NOT NULL,
  precio_por_noche DECIMAL(10,2) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  notas_huesped TEXT,
  notas_internas TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Patrón de middleware de auth existente
```javascript
// Ejemplo de uso en routes existentes:
const { authenticateToken, requireRole } = require('../middleware/auth');
router.get('/ruta', authenticateToken, requireRole(['gerente']), handler);
```

---

## INSTRUCCIONES GENERALES

1. **Lee todos los archivos existentes antes de crear nuevos**. Usa `cat`, `ls`, `grep` para entender lo que ya existe.
2. **No rompas nada existente**. Toda la funcionalidad actual debe seguir funcionando.
3. **Una migración por módulo**. Crea archivos de migración con timestamp en el nombre.
4. **Tests mínimos**: al menos un test de integración por endpoint nuevo.
5. **Maneja errores en todos los endpoints**: 400, 401, 403, 404, 409, 500 con mensajes descriptivos.
6. **Transacciones de base de datos** en operaciones que tocan múltiples tablas (especialmente en check-in).
7. **Comenta el código** cuando la lógica no sea obvia.
8. **Actualiza el README** con los nuevos endpoints al final.

---

## ═══════════════════════════════════════
## MÓDULO 07: GESTIÓN DE HABITACIONES
## ═══════════════════════════════════════

> **Desarrolla este módulo PRIMERO. Los módulos 01 y 03 dependen de él.**

### Objetivo
Extender la tabla `habitaciones` existente y crear el CRUD completo para que el gerente pueda configurar el inventario de habitaciones, tipos personalizados y reglas de temporada.

---

### PASO 7.1 — Migración de base de datos

Crea el archivo `backend/src/migrations/YYYYMMDDHHMMSS-extend-habitaciones-mod07.js`:

```sql
-- Campos a agregar a la tabla habitaciones existente:
ALTER TABLE habitaciones
  ADD COLUMN IF NOT EXISTS capacidad_adultos SMALLINT,
  ADD COLUMN IF NOT EXISTS capacidad_ninos SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS moneda_tarifa VARCHAR(3) DEFAULT 'PEN',
  ADD COLUMN IF NOT EXISTS fotos JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS visible_otas BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS hotel_id UUID,  -- para multi-sede futuro, nullable por ahora
  ADD COLUMN IF NOT EXISTS tipo_id UUID;   -- FK a tipos_habitacion personalizada

-- Nueva tabla: tipos de habitación personalizados
CREATE TABLE IF NOT EXISTS tipos_habitacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(50) NOT NULL,
  descripcion TEXT,
  color_mapa VARCHAR(7) DEFAULT '#3B82F6',
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Nueva tabla: reglas de temporada
CREATE TABLE IF NOT EXISTS reglas_temporada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre VARCHAR(100) NOT NULL,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('temporada_alta','temporada_baja','fin_de_semana','evento_especial','estadia_larga')),
  fecha_inicio DATE,           -- null si tipo = fin_de_semana o estadia_larga
  fecha_fin DATE,              -- null si tipo = fin_de_semana o estadia_larga
  ajuste_porcentaje DECIMAL(5,2) NOT NULL, -- positivo = aumento, negativo = descuento
  estadia_minima_noches INT,  -- solo para tipo = estadia_larga
  aplica_a_tipos JSONB DEFAULT '[]',  -- array de tipo_habitacion. Vacío = aplica a todos
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### PASO 7.2 — Backend: extender routes/habitaciones.js

Agrega los siguientes endpoints al archivo existente `backend/src/routes/habitaciones.js`. **No borres los endpoints existentes**.

```
GET    /api/v1/habitaciones                    → lista con filtros + tarifa_sugerida_hoy
POST   /api/v1/habitaciones                    → crear. Solo rol: gerente
GET    /api/v1/habitaciones/:id               → detalle completo con fotos e historial precios 30 días
PUT    /api/v1/habitaciones/:id               → editar completo. Solo gerente
DELETE /api/v1/habitaciones/:id               → baja lógica (fuera_de_servicio = true). Solo gerente. Solo si no hay reservas activas.
POST   /api/v1/habitaciones/:id/fotos         → subir hasta 10 fotos. Guarda en /uploads/habitaciones/:id/
PATCH  /api/v1/habitaciones/:id/fotos         → reordenar y cambiar foto principal

GET    /api/v1/tipos-habitacion               → lista tipos (predefinidos + personalizados activos)
POST   /api/v1/tipos-habitacion               → crear tipo personalizado. Solo gerente
PUT    /api/v1/tipos-habitacion/:id           → editar tipo. Solo gerente

GET    /api/v1/reglas-temporada               → lista reglas activas
POST   /api/v1/reglas-temporada               → crear regla. Solo gerente
PUT    /api/v1/reglas-temporada/:id           → editar regla. Solo gerente
DELETE /api/v1/reglas-temporada/:id           → desactivar regla. Solo gerente
```

**Lógica especial para GET /api/v1/habitaciones**:
- Consultar el microservicio IA en `http://localhost:8001/pricing/sugerido?habitacion_id=X&fecha=hoy` para agregar el campo `tarifa_sugerida_hoy` a cada habitación. Si el microservicio no responde en 2s: usar `tarifa_base` como fallback sin fallar el endpoint.
- Filtros por query params: `?piso=2&tipo=doble&estado=disponible&visible_otas=true`

**Lógica para DELETE (baja lógica)**:
```javascript
// Verificar que no hay reservas activas antes de dar de baja
const reservasActivas = await Reserva.count({
  where: {
    habitacion_id: req.params.id,
    estado: { [Op.in]: ['confirmada', 'checkin'] },
    fecha_salida: { [Op.gte]: new Date() }
  }
});
if (reservasActivas > 0) {
  return res.status(409).json({
    error: 'HABITACION_CON_RESERVAS_ACTIVAS',
    message: 'No se puede dar de baja una habitación con reservas activas'
  });
}
```

**Validaciones para POST/PUT habitación**:
- `tarifa_minima` < `tarifa_base` < `tarifa_maxima`
- `capacidad_adultos` >= 1
- `numero` único por hotel
- `piso` >= 0

---

### PASO 7.3 — Backend: service nuevo `services/tarifas.js`

Crea `backend/src/services/tarifas.js` con la siguiente función:

```javascript
/**
 * Calcula el precio ajustado de una habitación para una fecha dada,
 * aplicando las reglas de temporada activas.
 * 
 * Orden de precedencia:
 * 1. Evento especial (mayor peso)
 * 2. Temporada alta / baja
 * 3. Fin de semana
 * 4. Estadía larga (descuento)
 * 
 * Nunca retorna un precio menor a tarifa_minima ni mayor a tarifa_maxima.
 */
async function calcularTarifaConReglas(habitacion, fechaEntrada, fechaSalida) { ... }

/**
 * Obtiene todas las reglas activas que aplican a una habitación en un rango de fechas.
 * Retorna array de reglas ordenadas por prioridad.
 */
async function obtenerReglasAplicables(habitacion, fechaEntrada, fechaSalida) { ... }

module.exports = { calcularTarifaConReglas, obtenerReglasAplicables };
```

---

### PASO 7.4 — Frontend: componentes React

Crea los siguientes componentes en `frontend/src/pages/habitaciones/`:

#### `HabitacionesPage.jsx` (ruta: `/habitaciones`)
- Tabla de habitaciones con columnas: Nro., Piso, Tipo, Estado (badge de color), Capacidad, Tarifa base, Tarifa sugerida hoy, Acciones
- Filtros superiores: piso, tipo, estado
- Botón "Nueva habitación" (solo visible para rol gerente)
- Badge de estado con colores: verde=disponible, azul=ocupada, amarillo=limpieza, rojo=mantenimiento, gris=fuera_servicio
- Al hacer clic en una fila: abrir modal de detalle

#### `HabitacionForm.jsx` (modal o page)
Formulario con 4 secciones con tabs o acordeón:
1. **Datos generales**: número, piso, tipo (dropdown con tipos predefinidos + personalizados), descripción, capacidad adultos, capacidad niños, metros cuadrados
2. **Tarifas**: tarifa base (S/), tarifa mínima, tarifa máxima, moneda (PEN/USD). Mostrar advertencia si mínima >= base
3. **Amenities**: checkboxes para: WiFi, A/C, TV Cable, Frigobar, Caja Fuerte, Bañera, Ducha, Balcón, Vista al mar, Vista a la ciudad, Escritorio, Plancha, Secador de pelo. Campo de texto para agregar amenity personalizado con botón "Agregar".
4. **Fotos**: zona de drag & drop para subir fotos (máx 10). Preview de miniaturas. Marcar foto principal con estrella. Reordenar con drag.

#### `TiposHabitacionPage.jsx` (ruta: `/habitaciones/tipos`)
- Lista de tipos con: nombre, descripción, color (muestra chip de color), estado activo/inactivo
- Formulario inline para crear/editar: nombre, descripción, color (color picker)
- Solo visible/accesible para rol gerente

#### `ReglasTarifaPage.jsx` (ruta: `/habitaciones/tarifas`)
- Tabla de reglas de temporada activas
- Formulario para crear regla: nombre, tipo (dropdown), fecha inicio/fin (si aplica), % de ajuste (con indicador de + o -), estadía mínima (si aplica)
- Toggle activo/inactivo por regla
- Solo para rol gerente

---

### PASO 7.5 — Tests mínimos

Crea `backend/tests/habitaciones.mod07.test.js`:
- Test: GET /habitaciones con filtros retorna solo las habitaciones del filtro
- Test: POST /habitaciones con rol recepcionista retorna 403
- Test: POST /habitaciones con datos inválidos (tarifa_min > tarifa_base) retorna 400
- Test: DELETE /habitacion con reserva activa retorna 409
- Test: POST /reglas-temporada crea regla y afecta el cálculo de tarifa

---

## ═══════════════════════════════════════
## MÓDULO 01: REGISTRO MANUAL CON RENIEC/SUNAT
## ═══════════════════════════════════════

> **Desarrolla este módulo DESPUÉS del Módulo 07.**

### Objetivo
Flujo completo de check-in manual: selección de habitación → identificación del cliente (RENIEC/SUNAT/manual) → pago multi-método → comprobante SUNAT → envío por WhatsApp.

---

### PASO 1.1 — Migración de base de datos

Crea `backend/src/migrations/YYYYMMDDHHMMSS-extend-checkin-manual-mod01.js`:

```sql
-- Extender tabla huespedes
ALTER TABLE huespedes
  ADD COLUMN IF NOT EXISTS nacionalidad VARCHAR(50),
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_doc DATE,
  ADD COLUMN IF NOT EXISTS notas_internas TEXT,
  ADD COLUMN IF NOT EXISTS ultima_visita DATE;

-- Extender tabla reservas
ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS tipo_comprobante VARCHAR(10) DEFAULT 'boleta'
    CHECK (tipo_comprobante IN ('boleta','factura')),
  ADD COLUMN IF NOT EXISTS datos_facturacion JSONB,  -- {ruc, razon_social, direccion, email}
  ADD COLUMN IF NOT EXISTS canal_envio_comprobante VARCHAR(20) DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS comprobante_serie VARCHAR(10),
  ADD COLUMN IF NOT EXISTS comprobante_numero VARCHAR(10),
  ADD COLUMN IF NOT EXISTS comprobante_url TEXT;

-- Nueva tabla: pagos (si no existe ya)
CREATE TABLE IF NOT EXISTS pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reserva_id UUID NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
  metodo VARCHAR(30) NOT NULL
    CHECK (metodo IN ('efectivo','yape','plin','tarjeta_debito','tarjeta_credito','transferencia')),
  monto DECIMAL(10,2) NOT NULL,
  referencia VARCHAR(100),  -- nro. de operación Yape, Plin, etc.
  estado VARCHAR(20) DEFAULT 'completado',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### PASO 1.2 — Backend: nuevo service `services/reniec.js`

```javascript
/**
 * Consulta la API de RENIEC para obtener datos de un DNI.
 * Cache en Redis por 24 horas (misma persona no cambia de nombre en un día).
 * Timeout de 3 segundos. Si falla: retorna null para que el frontend permita ingreso manual.
 */
async function consultarDNI(dni) {
  // 1. Validar formato: exactamente 8 dígitos numéricos
  // 2. Buscar en Redis: key = `reniec:${dni}`
  // 3. Si no está en cache: llamar a la API externa de RENIEC
  //    URL: process.env.RENIEC_API_URL (configurar en .env)
  //    Headers: Authorization: Bearer process.env.RENIEC_API_TOKEN
  // 4. Si responde: guardar en Redis con TTL = 86400 (24h), retornar datos
  // 5. Si no responde en 3s o error: retornar null (no lanzar excepción)
  // Retorna: { nombres, apellidos, fecha_nacimiento, direccion } | null
}

/**
 * Consulta la API de SUNAT para obtener datos de un RUC.
 * Cache en Redis por 1 hora.
 * Timeout de 3 segundos.
 */
async function consultarRUC(ruc) {
  // 1. Validar formato: exactamente 11 dígitos, empieza con 10 o 20
  // 2. Buscar en Redis: key = `sunat:${ruc}`
  // 3. Si no: llamar a API de SUNAT (process.env.SUNAT_API_CONSULTA_URL)
  // 4. Retornar: { razon_social, estado, condicion, direccion, ubigeo } | null
}

module.exports = { consultarDNI, consultarRUC };
```

**Agrega al `.env.example`**:
```
RENIEC_API_URL=https://api.reniec.gob.pe/v1
RENIEC_API_TOKEN=
SUNAT_API_CONSULTA_URL=https://api.sunat.gob.pe/v1/contribuyente
```

---

### PASO 1.3 — Backend: nuevos endpoints en routes/

**Nuevo archivo `backend/src/routes/clientes.js`**:
```
GET /api/v1/clientes/reniec/:dni
  → Consulta RENIEC vía service reniec.js
  → Retorna: { encontrado: true|false, nombres, apellidos, fecha_nacimiento, direccion }
  → Si encontrado=false: el frontend muestra los campos vacíos para ingreso manual
  → Roles: gerente, recepcionista

GET /api/v1/clientes/sunat/:ruc
  → Consulta SUNAT vía service reniec.js
  → Retorna: { encontrado: true|false, razon_social, estado, condicion, direccion }
  → Roles: gerente, recepcionista
```

**Extender `backend/src/routes/huespedes.js`** (agregar al existente):
```
POST /api/v1/huespedes
  → Upsert: si ya existe (tipo_doc + numero_doc) actualiza datos y retorna el existente con flag is_returning: true
  → Si es nuevo: crea el registro y retorna con is_returning: false
  → Body: { tipo_documento, numero_documento, nombres, apellidos, email?, telefono?, nacionalidad?, notas_internas? }
  → Roles: gerente, recepcionista
```

**Nuevo archivo `backend/src/routes/checkin.js`**:
```
POST /api/v1/reservas/checkin-manual
  Body requerido:
  {
    huesped_id: UUID,              // ya creado/obtenido en el paso anterior
    habitacion_id: string,
    fecha_entrada: date,
    numero_noches: int,
    numero_personas: int,
    precio_por_noche: decimal,
    pagos: [{ metodo, monto, referencia? }],   // array, suma debe = total
    tipo_comprobante: "boleta" | "factura",
    datos_facturacion?: { ruc, razon_social, direccion, email },
    canal_envio_comprobante: "whatsapp" | "email" | "ambos" | "ninguno"
  }

  Lógica (TODO en una sola transacción de base de datos):
  1. Verificar disponibilidad de la habitación en esas fechas (usar service disponibilidad.js existente)
  2. Verificar número de personas <= capacidad de la habitación
  3. Calcular total = precio_por_noche * numero_noches
  4. Verificar que la suma de pagos[] == total (tolerancia de ±0.01 por redondeos)
  5. Crear registro en tabla reservas (estado = 'checkin')
  6. Crear registros en tabla pagos (uno por cada método)
  7. Cambiar estado de habitación a 'ocupada' en tabla habitaciones
  8. Actualizar Redis con el nuevo estado de la habitación
  9. Crear folio inicial en tabla folio_items con el cargo de la habitación
  10. COMMIT de la transacción
  11. (Async, no bloquear la respuesta):
      - Llamar a service sunat.js para emitir el comprobante
      - Si sunat.js falla: encolar en Redis para reintento (key: `sunat_pendiente:${reserva_id}`)
      - Llamar a service notificaciones.js para enviar comprobante por WPP/email según canal_envio_comprobante
      - Disparar webhook a n8n para notificar al grupo de WPP del hotel

  Respuesta exitosa (201):
  {
    reserva_id, codigo_reserva, habitacion_numero, huesped_nombre,
    fecha_entrada, fecha_salida, total, comprobante_estado: "emitiendo" | "emitido" | "error"
  }

  Errores específicos:
  - 409 HABITACION_NO_DISPONIBLE: la habitación ya tiene reserva en esas fechas
  - 409 CAPACIDAD_EXCEDIDA: número de personas supera la capacidad
  - 422 PAGOS_NO_COINCIDEN: la suma de pagos no coincide con el total
  - 422 FECHAS_INVALIDAS: fecha_salida <= fecha_entrada

GET /api/v1/reservas/checkin-manual/disponibles
  Query params: ?fecha_entrada=YYYY-MM-DD&fecha_salida=YYYY-MM-DD&personas=2
  → Retorna habitaciones disponibles para esas fechas con tarifa_sugerida incluida
  → Roles: gerente, recepcionista
```

---

### PASO 1.4 — Frontend: flujo de 5 pasos

Crea `frontend/src/pages/checkin/CheckinManualPage.jsx`.

Implementa un wizard de 5 pasos con barra de progreso visual:

#### Paso 1 — Selección de habitación
```jsx
// Mostrar mapa/grid de habitaciones usando el componente de mapa existente
// Filtrar: solo habitaciones disponibles para las fechas a ingresar
// Campos en este paso:
//   - fecha_entrada (DatePicker, default: hoy)
//   - numero_noches (número, mínimo 1) O fecha_salida (se calculan mutuamente)
//   - numero_personas (número, mínimo 1)
// Al seleccionar habitación: mostrar panel lateral con:
//   - Tipo, capacidad, amenities (chips), foto principal
//   - precio_por_noche sugerido por IA (editable, campo de input)
//   - Total calculado en tiempo real = precio * noches
//   - Fecha de salida calculada y destacada
// Botón "Continuar con esta habitación" → activo solo si hay hab. seleccionada
```

#### Paso 2 — Datos del cliente
```jsx
// Selector de tipo de documento: DNI | RUC | Pasaporte | Carnet Extranjería | Doc. Extranjero
// Campo: número de documento
// Botón "Buscar"
//
// Al hacer clic en "Buscar":
//   - Si tipo = DNI: GET /api/v1/clientes/reniec/:dni
//   - Si tipo = RUC: GET /api/v1/clientes/sunat/:ruc
//   - Mostrar spinner mientras busca
//   - Si encontrado en BD propia (checar GET /api/v1/huespedes?doc=...): 
//       mostrar banner VERDE "Cliente registrado — datos completados automáticamente"
//       campos en solo lectura (excepto teléfono y email)
//   - Si encontrado en RENIEC/SUNAT pero no en BD propia:
//       mostrar banner AZUL "Datos obtenidos de RENIEC/SUNAT — completa los datos de contacto"
//       nombre/apellidos pre-rellenados, teléfono y email editables
//   - Si no encontrado en ningún lado:
//       mostrar banner GRIS "Ingresa los datos manualmente"
//       todos los campos editables
//   - Si RENIEC/SUNAT no responde (timeout):
//       mostrar aviso "Servicio no disponible — ingresa los datos manualmente"
//
// Campos siempre editables: teléfono, email, observaciones
// POST /api/v1/huespedes al hacer "Continuar" (upsert)
```

#### Paso 3 — Método de pago
```jsx
// Selector multi-método de pago
// Métodos: Efectivo | Yape | Plin | Tarjeta Débito | Tarjeta Crédito | Transferencia
// Para cada método agregado: campo "Monto" (S/)
// Botón "+" para agregar otro método de pago
// Botón "×" para eliminar un método
//
// Mostrar siempre:
//   - Total a pagar: S/ {total}
//   - Total ingresado: S/ {suma de montos} — en verde si coincide, rojo si no
//   - Diferencia: S/ {diferencia} — mostrar 0.00 cuando esté correcto
//
// Si el primer método es Efectivo:
//   - Mostrar campo "Monto recibido" adicional
//   - Calcular y mostrar "Vuelto: S/ {monto_recibido - total}"
//
// Validación: no puede avanzar si suma de montos ≠ total (tolerancia 0.01)
```

#### Paso 4 — Tipo de comprobante
```jsx
// Radio buttons: Boleta | Factura
// Si el cliente se registró con RUC en el paso 2: pre-seleccionar Factura
// Si se selecciona Factura: mostrar campos adicionales:
//   - RUC (pre-rellenado si se ingresó en paso 2)
//   - Razón social (pre-rellenado)
//   - Dirección fiscal (pre-rellenado)
//   - Email para envío de factura
// Selector de canal de envío del comprobante: WhatsApp | Correo | Ambos | Solo imprimir
//   - WhatsApp: pre-seleccionado si el cliente tiene teléfono registrado
```

#### Paso 5 — Resumen y confirmación
```jsx
// Mostrar resumen visual de todo:
//   - Habitación: número, tipo, piso
//   - Cliente: nombre completo, tipo y nro. de documento
//   - Fechas: entrada → salida (X noches)
//   - Precio: S/ {precio}/noche × {noches} noches = S/ {total}
//   - Pagos: lista de métodos y montos
//   - Comprobante: boleta/factura + canal de envío
//
// Botón principal: "Confirmar Check-in" → POST /api/v1/reservas/checkin-manual
// Botón secundario: "Volver" → regresa al paso 4
//
// Mientras procesa: spinner + mensaje "Procesando check-in..."
// Si éxito: modal de confirmación con:
//   - Animación de éxito (check verde)
//   - Datos del check-in: habitación, código de reserva, fecha de salida
//   - Botones: "Imprimir voucher" | "Nuevo check-in" | "Ver reservas"
// Si error: mostrar el mensaje de error específico con botón "Reintentar"
```

---

### PASO 1.5 — Webhook n8n para notificación de grupo WPP

En el service `notificaciones.js` existente, agregar la función:

```javascript
async function notificarGrupoCheckin(reserva, huesped, habitacion, recepcionista) {
  // Llamar al webhook de n8n configurado en N8N_WEBHOOK_URL
  // Body del webhook:
  // {
  //   evento: 'checkin_completado',
  //   cliente: huesped.nombres + ' ' + huesped.apellidos,
  //   doc: huesped.tipo_documento + ' ' + huesped.numero_documento,
  //   habitacion: habitacion.numero + ' - ' + habitacion.tipo,
  //   noches: reserva.numero_noches,
  //   fecha_entrada: reserva.fecha_entrada,
  //   fecha_salida: reserva.fecha_salida,
  //   precio_noche: reserva.precio_por_noche,
  //   total: reserva.total,
  //   recepcionista: recepcionista.nombre
  // }
  // Si n8n no responde: loguear el error pero no fallar el check-in
}
```

---

### PASO 1.6 — Tests mínimos

Crea `backend/tests/checkin.mod01.test.js`:
- Test: GET /clientes/reniec/12345678 retorna datos o null (mockear API externa)
- Test: POST /huespedes con DNI existente retorna is_returning: true
- Test: POST /reservas/checkin-manual exitoso crea reserva + pagos + cambia estado hab.
- Test: POST con habitación ocupada retorna 409 HABITACION_NO_DISPONIBLE
- Test: POST con suma de pagos incorrecta retorna 422 PAGOS_NO_COINCIDEN
- Test: POST con más personas que capacidad retorna 409 CAPACIDAD_EXCEDIDA

---

## ═══════════════════════════════════════
## MÓDULO 03: REPORTE DE TURNO
## ═══════════════════════════════════════

> **Desarrolla este módulo DESPUÉS del Módulo 01.**

### Objetivo
Sistema de apertura y cierre de turnos (día/noche) con generación de reporte exportable, registro de gastos de caja, resumen por método de pago y firma digital del recepcionista.

---

### PASO 3.1 — Migración de base de datos

Crea `backend/src/migrations/YYYYMMDDHHMMSS-create-turnos-mod03.js`:

```sql
CREATE TABLE IF NOT EXISTS turnos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id UUID,  -- nullable, para multi-sede futuro
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('dia','noche')),
  recepcionista_id UUID NOT NULL REFERENCES personal(id),
  fecha DATE NOT NULL,
  hora_apertura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hora_cierre TIMESTAMPTZ,
  saldo_inicial DECIMAL(10,2) NOT NULL DEFAULT 0,
  saldo_final DECIMAL(10,2),
  estado VARCHAR(10) NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','cerrado')),
  firma_hash VARCHAR(64),   -- SHA256 del contenido del reporte al momento del cierre
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Un solo turno abierto a la vez (por hotel en el futuro, por ahora global)
CREATE UNIQUE INDEX IF NOT EXISTS idx_turnos_abierto ON turnos (estado) WHERE estado = 'abierto';

CREATE TABLE IF NOT EXISTS gastos_caja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id UUID NOT NULL REFERENCES turnos(id) ON DELETE CASCADE,
  concepto VARCHAR(200) NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  comprobante_proveedor VARCHAR(50),  -- nro. de boleta/factura del proveedor
  registrado_por UUID NOT NULL REFERENCES personal(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reporte_turno_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turno_id UUID NOT NULL UNIQUE REFERENCES turnos(id),
  json_reporte JSONB NOT NULL,
  pdf_url TEXT,
  generado_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### PASO 3.2 — Backend: nuevo archivo `routes/turnos.js`

```
POST /api/v1/turnos/abrir
  → Verificar que no haya un turno abierto actualmente (retornar 409 si hay uno)
  → Body: { tipo: "dia"|"noche", saldo_inicial: decimal }
  → Crear turno con recepcionista_id del JWT
  → Roles: gerente, recepcionista

GET /api/v1/turnos/activo
  → Retorna el turno actualmente abierto
  → Incluye resumen en tiempo real:
    {
      turno: { id, tipo, recepcionista, hora_apertura, saldo_inicial },
      resumen: {
        total_checkins: int,       -- COUNT reservas creadas durante el turno
        total_checkouts: int,      -- COUNT checkouts durante el turno
        total_efectivo: decimal,   -- SUM pagos metodo=efectivo del turno
        total_yape: decimal,
        total_plin: decimal,
        total_tarjetas: decimal,
        total_transferencias: decimal,
        total_general: decimal,
        total_gastos_caja: decimal,
        efectivo_neto: decimal,    -- total_efectivo - total_gastos_caja
        saldo_final_proyectado: decimal  -- saldo_inicial + efectivo_neto
      }
    }
  → Roles: gerente, recepcionista

POST /api/v1/turnos/:id/gastos
  → Registrar un gasto de caja
  → Body: { concepto, monto, comprobante_proveedor? }
  → Roles: gerente, recepcionista

GET /api/v1/turnos/:id/gastos
  → Lista gastos del turno
  → Roles: gerente, recepcionista

POST /api/v1/turnos/:id/cerrar
  → Body: { pin: string }  -- PIN de 4 dígitos o contraseña del usuario
  → Verificar el PIN comparando con el password del recepcionista (bcrypt)
  → Generar el JSON completo del reporte (ver estructura abajo)
  → Calcular saldo_final
  → Generar firma_hash = SHA256(JSON.stringify(reporte) + turno_id + timestamp)
  → Guardar en reporte_turno_cache
  → Actualizar turno: estado='cerrado', hora_cierre=NOW(), firma_hash, saldo_final
  → Generar PDF del reporte y guardarlo (ver PASO 3.3)
  → Disparar webhook n8n para enviar resumen al grupo WPP
  → Roles: gerente, recepcionista

GET /api/v1/turnos/:id/reporte
  → Retorna el JSON del reporte del turno (desde cache o lo genera en el momento)
  → Roles: gerente, recepcionista

GET /api/v1/turnos/:id/reporte/pdf
  → Retorna el PDF del reporte (desde cache o genera uno nuevo)
  → Content-Type: application/pdf
  → Roles: gerente, recepcionista

GET /api/v1/turnos
  → Historial de turnos cerrados
  → Filtros: ?fecha=YYYY-MM-DD&tipo=dia|noche&recepcionista_id=UUID
  → Paginado: ?page=1&limit=20
  → Roles: gerente (ver todos), recepcionista (solo los suyos)
```

**Estructura del JSON del reporte**:
```javascript
{
  // SECCIÓN A — Encabezado
  encabezado: {
    empresa: process.env.HOTEL_NOMBRE,
    ruc: process.env.SUNAT_RUC,
    establecimiento: process.env.HOTEL_ESTABLECIMIENTO,
    direccion: process.env.HOTEL_DIRECCION,
    vendedor: recepcionista.nombre,
    turno: 'DIA' | 'NOCHE',
    fecha_reporte: turno.fecha,
    hora_apertura: turno.hora_apertura,
    hora_cierre: NOW(),
    estado_caja: 'CERRADA',
    saldo_inicial: turno.saldo_inicial
  },

  // SECCIÓN B — Detalle de transacciones del turno
  // Incluir TODAS las reservas donde hora de creación está dentro del turno
  transacciones: [
    {
      nro_transaccion: '0001', // numeración secuencial dentro del turno
      tipo_comprobante: 'Boleta' | 'Factura',
      nro_documento_comprobante: 'B001-0032',
      fecha_emision: datetime,
      cliente: huesped.nombres + ' ' + huesped.apellidos,
      doc_cliente: huesped.tipo_documento + ': ' + huesped.numero_documento,
      nro_habitacion: habitacion.numero,
      observacion: reserva.notas_internas,
      moneda: 'PEN' | 'USD',
      monto: pago.monto,
      metodo_pago: pago.metodo,
      total_a_pagar: reserva.total
    }
  ],

  // SECCIÓN C — Gastos de caja
  gastos_caja: [
    { fecha: datetime, concepto, monto, comprobante_proveedor, registrado_por }
  ],
  total_gastos_caja: decimal,

  // SECCIÓN D — Resumen por método de pago
  resumen_pagos: {
    efectivo:         { cantidad: int, total: decimal },
    yape:             { cantidad: int, total: decimal },
    plin:             { cantidad: int, total: decimal },
    tarjeta_debito:   { cantidad: int, total: decimal },
    tarjeta_credito:  { cantidad: int, total: decimal },
    transferencia:    { cantidad: int, total: decimal }
  },

  // SECCIÓN E — Totales de caja
  totales: {
    total_efectivo_bruto: decimal,
    total_gastos_caja: decimal,
    efectivo_neto: decimal,
    total_billeteras_digitales: decimal,  // yape + plin
    total_tarjetas: decimal,
    total_transferencias: decimal,
    total_general: decimal,
    saldo_final_caja: decimal  // saldo_inicial + efectivo_neto
  },

  // Firma
  firma: {
    recepcionista_id: UUID,
    recepcionista_nombre: string,
    firma_hash: string,
    firmado_at: datetime
  }
}
```

Agrega al `.env.example`:
```
HOTEL_NOMBRE=
HOTEL_ESTABLECIMIENTO=
HOTEL_DIRECCION=
```

---

### PASO 3.3 — Generación de PDF del reporte

Usa la librería `pdfkit` (instalarla si no está: `npm install pdfkit`).

Crea `backend/src/services/reporteTurno.js`:
```javascript
const PDFDocument = require('pdfkit');

/**
 * Genera el PDF del reporte de turno.
 * El PDF debe tener las 5 secciones definidas en la especificación.
 * Retorna un Buffer con el PDF listo para enviar como response o guardar en disco.
 */
async function generarPDFReporte(jsonReporte) {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });

  // ENCABEZADO: logo (si existe), nombre del hotel, RUC, datos del turno
  // SECCIÓN A: tabla con datos del encabezado del turno
  // SECCIÓN B: tabla de transacciones con columnas: Nro | Comprobante | Nro Doc | Fecha | Cliente | Doc Cliente | Hab. | Moneda | Monto
  // SECCIÓN C: tabla de gastos de caja
  // SECCIÓN D: tabla de resumen por método de pago
  // SECCIÓN E: tabla de totales con fila final destacada
  // PIE: nombre del recepcionista, fecha/hora de cierre, hash de firma (primeros 16 chars)

  return pdfBuffer;
}

module.exports = { generarPDFReporte };
```

Guarda los PDFs generados en: `backend/uploads/reportes/turno_${turno_id}.pdf`

---

### PASO 3.4 — Frontend: componentes React

#### `TurnoWidget.jsx` — widget en el header del dashboard
```jsx
// Widget siempre visible en el header para recepcionista y gerente
// Si hay turno abierto:
//   - Indicador verde: "Turno DÍA · Desde 06:00"
//   - Total acumulado del turno: S/ {total_general}
//   - Botón "Ver detalles del turno"
// Si no hay turno abierto:
//   - Indicador rojo: "Sin turno activo"
//   - Botón "Abrir turno"
```

#### `AbrirTurnoModal.jsx`
```jsx
// Modal para abrir un nuevo turno
// Campos:
//   - Tipo de turno: radio buttons "DÍA (06:00 - 18:00)" | "NOCHE (18:00 - 06:00)"
//   - Saldo inicial en efectivo: campo numérico con S/ adelante
//     Mostrar ayuda: "Ingresa el monto de efectivo físico que hay en la caja al inicio del turno"
// Botón "Abrir turno"
// POST /api/v1/turnos/abrir
```

#### `TurnoActivoPage.jsx` (ruta: `/turno`)
```jsx
// Página de detalle del turno activo
// Actualización cada 30 segundos (polling GET /api/v1/turnos/activo)
//
// Layout en 2 columnas:
// IZQUIERDA:
//   - Info del turno: tipo, recepcionista, hora apertura, saldo inicial
//   - Tabla de transacciones del turno (actualizada en tiempo real)
//   - Formulario "Registrar gasto de caja": concepto, monto, nro. comprobante proveedor
//
// DERECHA:
//   - Cards de resumen: Total Efectivo | Yape/Plin | Tarjetas | Total General
//   - Lista de gastos de caja del turno
//   - Botón "Cerrar turno" (rojo, requiere confirmación)
```

#### `CerrarTurnoModal.jsx`
```jsx
// Modal de confirmación antes de cerrar el turno
// Muestra resumen final: total checkins, checkouts, efectivo neto, total general
// Campo: "Confirma tu contraseña o PIN para firmar el cierre"
// Botón "Confirmar y cerrar turno"
// POST /api/v1/turnos/:id/cerrar
// Tras el cierre exitoso: mostrar botones "Descargar PDF" | "Enviar por correo" | "Volver al dashboard"
```

#### `HistorialTurnosPage.jsx` (ruta: `/turnos/historial`, solo gerente)
```jsx
// Tabla paginada de turnos cerrados
// Columnas: Fecha | Tipo | Recepcionista | Apertura | Cierre | Saldo Inicial | Total | Acciones
// Acciones por fila: "Ver reporte" | "Descargar PDF"
// Filtros: fecha, tipo, recepcionista
```

---

### PASO 3.5 — Tests mínimos

Crea `backend/tests/turnos.mod03.test.js`:
- Test: POST /turnos/abrir crea turno correctamente
- Test: POST /turnos/abrir cuando ya hay un turno abierto retorna 409
- Test: GET /turnos/activo retorna resumen calculado correctamente
- Test: POST /turnos/:id/cerrar con PIN incorrecto retorna 401
- Test: POST /turnos/:id/cerrar genera reporte con las transacciones del turno
- Test: GET /turnos/:id/reporte/pdf retorna Content-Type: application/pdf

---

## ORDEN FINAL DE EJECUCIÓN

Ejecuta en este orden exacto:

```bash
# 1. Módulo 07 — Base
cd backend
node src/migrations/YYYYMMDDHHMMSS-extend-habitaciones-mod07.js
npm test tests/habitaciones.mod07.test.js

# 2. Módulo 01 — Check-in
node src/migrations/YYYYMMDDHHMMSS-extend-checkin-manual-mod01.js
npm test tests/checkin.mod01.test.js

# 3. Módulo 03 — Turnos
npm install pdfkit
node src/migrations/YYYYMMDDHHMMSS-create-turnos-mod03.js
npm test tests/turnos.mod03.test.js

# 4. Verificar que los tests existentes siguen pasando
npm test

# 5. Arrancar el sistema completo y verificar manualmente
npm run dev
```

---

## CRITERIOS DE ÉXITO

El desarrollo está completo cuando:

- [ ] `npm test` pasa al 100% (existentes + nuevos)
- [ ] Se puede hacer un check-in manual completo de principio a fin en el frontend
- [ ] La búsqueda por DNI consulta RENIEC (o falla gracefully en timeout)
- [ ] Al confirmar check-in, el estado de la habitación cambia a "ocupada" en el mapa
- [ ] Se puede abrir y cerrar un turno con generación de PDF
- [ ] El reporte PDF tiene las 5 secciones y muestra la habitación en cada transacción
- [ ] El gerente puede crear/editar habitaciones y tipos de habitación
- [ ] Las reglas de temporada afectan el precio sugerido al seleccionar una habitación
- [ ] Ningún endpoint existente fue roto (backward compatibility)
