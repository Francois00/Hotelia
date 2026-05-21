# PROMPT CLAUDE CODE — FRONTEND MÓDULOS 01, 03 y 07
# Hotel Management System

---

## CONTEXTO DEL FRONTEND EXISTENTE

Lee estos archivos ANTES de escribir cualquier código:

```bash
# Leer la estructura completa primero
find frontend/src -type f | sort

# Leer los archivos clave
cat frontend/src/main.jsx          # o index.jsx — punto de entrada y Router
cat frontend/src/App.jsx           # rutas existentes
cat frontend/src/services/api.js   # cómo se hacen las llamadas al backend
cat frontend/src/components/HotelMap.jsx     # mapa de habitaciones existente
cat frontend/package.json          # dependencias disponibles
```

### Lo que ya existe (NO modificar, solo extender)

- `pages/Dashboard.jsx` — KPIs en tiempo real
- `pages/Reservas.jsx` — gestión de reservas
- `pages/Habitaciones.jsx` — mapa visual del hotel
- `pages/Revenue.jsx` — pricing y forecast
- `pages/CRM.jsx` — perfiles y segmentación
- `components/HotelMap.jsx` — grid de habitaciones por piso y estado
- `components/OcupacionChart.jsx` — forecast 90 días
- `components/RevPARGauge.jsx` — KPI principal

### Stack del frontend
- React + Vite (puerto 5173)
- Recharts para gráficas
- Backend en `http://localhost:3000`
- Polling cada 30s para datos que cambian frecuentemente
- JWT almacenado en localStorage con key `hotel_token`
- El token tiene estructura: `{ id, nombre, rol, hotel_ids[] }`

### Cómo se llama al backend hoy (respetar este patrón)
```javascript
// Leer api.js y seguir exactamente el mismo patrón que ya existe
// Por ejemplo, si usa axios:
import api from '../services/api'
const { data } = await api.get('/habitaciones')

// Si usa fetch con helper:
import { apiFetch } from '../services/api'
const data = await apiFetch('/habitaciones')
```

### Paleta de colores de estados de habitación (ya definida en HotelMap.jsx)
```
disponible  → verde   #22c55e
ocupada     → azul    #3b82f6
limpieza    → amarillo #eab308
mantenimiento → rojo  #ef4444
bloqueada   → gris    #6b7280
fuera_servicio → gris oscuro #374151
```

---

## INSTRUCCIONES GENERALES

1. **Lee cada archivo existente antes de crearlo o modificarlo**
2. **Sigue el patrón de código que ya existe** — misma estructura, mismo estilo de imports, mismos helpers
3. **Protección de rutas por rol** — lee cómo funciona actualmente y usa el mismo sistema
4. **No instales librerías nuevas** salvo que sea estrictamente necesario y lo justifiques
5. **Componentes reutilizables** — si algo se usa en 2+ lugares, extráelo a `components/`
6. **Loading states** en cada llamada al backend — spinner o skeleton mientras carga
7. **Error states** — mostrar mensaje claro si el backend falla, no pantallas en blanco
8. **Responsive** — funciona en tablet (1024px) que es lo que usa recepción en mostrador
9. **Al terminar cada módulo**: verifica que el Router en App.jsx tiene las rutas nuevas

---

## ══════════════════════════════════════════
## MÓDULO 07 — GESTIÓN DE HABITACIONES
## ══════════════════════════════════════════

> Desarrolla este módulo PRIMERO. El wizard de check-in (Módulo 01) usa su mapa.

### Endpoints disponibles en el backend

```
GET    /api/v1/habitaciones?piso=&tipo=&estado=&visible_otas=
       → retorna: [{ id, numero, piso, tipo, estado, capacidad_adultos, capacidad_ninos,
                     tarifa_base, tarifa_minima, tarifa_maxima, moneda_tarifa,
                     amenities[], fotos[], visible_otas, tarifa_sugerida_hoy }]

POST   /api/v1/habitaciones          (solo gerente)
PUT    /api/v1/habitaciones/:id      (solo gerente)
DELETE /api/v1/habitaciones/:id      (solo gerente)
PATCH  /api/v1/habitaciones/:id/estado
POST   /api/v1/habitaciones/:id/fotos
PATCH  /api/v1/habitaciones/:id/fotos

GET    /api/v1/tipos-habitacion
POST   /api/v1/tipos-habitacion      (solo gerente)
PUT    /api/v1/tipos-habitacion/:id  (solo gerente)

GET    /api/v1/reglas-temporada
POST   /api/v1/reglas-temporada      (solo gerente)
PUT    /api/v1/reglas-temporada/:id  (solo gerente)
DELETE /api/v1/reglas-temporada/:id  (solo gerente)
```

---

### 7.A — Modificar `pages/Habitaciones.jsx` (ya existe)

La página actual muestra el mapa. Agrégale dos tabs en la parte superior:

```
[ Mapa ]  [ Lista ]
```

**Tab "Mapa"** → el HotelMap.jsx actual, sin cambios.

**Tab "Lista"** → tabla nueva con estas columnas:

| Nro. | Piso | Tipo | Estado | Capacidad | Tarifa base | Tarifa IA hoy | Acciones |
|------|------|------|--------|-----------|-------------|---------------|----------|

- **Estado**: badge de color usando la paleta existente
- **Tarifa IA hoy**: mostrar en verde si es mayor que tarifa_base, en rojo si es menor. Si no hay datos del microservicio IA: mostrar `—` sin errores
- **Filtros** encima de la tabla: dropdown Piso, dropdown Tipo, dropdown Estado. Los dropdowns se poblan con los valores únicos de los datos cargados, no hardcodeados
- **Botón "Nueva habitación"**: visible SOLO si `rol === 'gerente'`. Abre el modal `HabitacionForm`
- **Acciones por fila**: botón Editar (abre `HabitacionForm` con datos pre-cargados) y botón Cambiar estado (abre mini-modal). Ambos solo visibles para `rol === 'gerente'`
- Polling cada 60s para mantener estados actualizados

---

### 7.B — Crear `components/habitaciones/HabitacionForm.jsx`

Modal de creación/edición con 4 tabs internos. Funciona para crear (sin datos iniciales) y editar (con datos pre-cargados).

```jsx
// Props:
// habitacion: object | null  → null = crear nuevo, object = editar
// onClose: () => void
// onSuccess: (habitacionActualizada) => void
```

**Tab 1 — Datos generales**
```
Número de habitación: input text, requerido, único
Piso: input number, min=0, requerido
Tipo: select con opciones del GET /api/v1/tipos-habitacion (incluye predefinidos y personalizados)
Descripción: textarea, opcional, placeholder "Descripción visible al huésped en Booking.com"
Capacidad adultos: input number, min=1, requerido
Capacidad niños: input number, min=0, default=0
Metros cuadrados: input number, min=1, opcional
```

**Tab 2 — Tarifas**
```
Moneda: radio PEN (Soles) | USD (Dólares)
Tarifa mínima: input decimal, requerido
Tarifa base: input decimal, requerido
Tarifa máxima: input decimal, requerido

Validación en tiempo real (mientras el usuario escribe):
- Si tarifa_minima >= tarifa_base: mostrar warning rojo debajo del campo
- Si tarifa_base >= tarifa_maxima: mostrar warning rojo
- Solo bloquear el submit, no bloquear la escritura

Mostrar debajo una barra visual:
[S/ min ---|------base------|--- max S/]
La barra se actualiza en tiempo real conforme se escriben los valores
```

**Tab 3 — Amenities**
```
Grid de checkboxes 3 columnas:
[ ] WiFi           [ ] Aire Acond.    [ ] TV Cable
[ ] Frigobar       [ ] Caja Fuerte    [ ] Bañera
[ ] Ducha          [ ] Balcón         [ ] Vista al mar
[ ] Vista ciudad   [ ] Escritorio     [ ] Plancha
[ ] Secador de pelo

Campo "Agregar amenity personalizado":
  input text + botón "Agregar"
  Al agregar: aparece como chip eliminable debajo de los checkboxes
  Los amenities personalizados se guardan igual que los predefinidos en el array amenities[]
```

**Tab 4 — Fotos**
```
Zona de drag & drop para subir imágenes
- Máximo 10 fotos
- Formatos: jpg, jpeg, png, webp
- Al soltar: preview inmediato con miniatura
- Primera foto subida: marcada automáticamente como principal (estrella llena ★)
- Las demás: estrella vacía ☆, al hacer clic → se convierte en principal
- Botón × en cada miniatura para eliminar
- Mostrar contador: "3 / 10 fotos"

Al guardar:
1. Primero POST /api/v1/habitaciones o PUT /api/v1/habitaciones/:id (datos sin fotos)
2. Si hay fotos nuevas: POST /api/v1/habitaciones/:id/fotos por cada archivo
3. Si cambió el orden o la principal: PATCH /api/v1/habitaciones/:id/fotos
```

**Botones del modal**:
```
[Cancelar]  [Guardar habitación]

Al hacer submit:
- Deshabilitar el botón + mostrar spinner
- Si éxito: cerrar modal, llamar onSuccess(), mostrar toast "Habitación guardada"
- Si error 409 (número duplicado): mostrar mensaje "Ya existe una habitación con ese número"
- Si error de validación del backend: mostrar el mensaje del backend debajo del campo correspondiente
```

---

### 7.C — Crear `pages/habitaciones/TiposHabitacionPage.jsx`

Ruta: `/habitaciones/tipos` — Solo accesible para `rol === 'gerente'`

```
Layout:
- Título "Tipos de Habitación"
- Tabla: Nombre | Descripción | Color | Activo | Acciones
  - Color: mostrar chip de color (cuadrado de 20x20px con el color)
  - Activo: toggle switch
  - Acciones: Editar (abre form inline en la misma fila) | Eliminar

- Formulario "Nuevo tipo" debajo de la tabla (siempre visible):
  Nombre: input text
  Descripción: input text
  Color: input type="color" (color picker nativo del navegador)
  [Crear tipo]

Tipos predefinidos (simple, doble, triple, suite, familiar):
- Mostrarlos en la tabla con badge "predefinido"
- No permiten edición ni eliminación (deshabilitar acciones)
```

---

### 7.D — Crear `pages/habitaciones/ReglasTarifaPage.jsx`

Ruta: `/habitaciones/tarifas` — Solo accesible para `rol === 'gerente'`

```
Layout en 2 columnas:

IZQUIERDA — Lista de reglas activas:
  Tabla: Nombre | Tipo | Período / Condición | Ajuste | Estado | Acciones
  - Tipo: badge de color según tipo
    temporada_alta → naranja
    temporada_baja → azul
    fin_de_semana → morado
    evento_especial → rojo
    estadia_larga → verde
  - Ajuste: "+30%" en verde, "-10%" en rojo
  - Estado: toggle activo/inactivo (llama a PUT /api/v1/reglas-temporada/:id)
  - Acciones: Editar | Eliminar

DERECHA — Formulario "Nueva regla":
  Nombre: input text
  Tipo: select (las 5 opciones)

  Mostrar condicionalmente según el tipo seleccionado:
  - Si temporada_alta, temporada_baja, evento_especial:
      Fecha inicio: date picker
      Fecha fin: date picker
      Validar: fecha_inicio < fecha_fin
  - Si estadia_larga:
      Noches mínimas: input number, min=2
  - Si fin_de_semana: no hay campos adicionales

  Ajuste %: input number con signo
    - Positivo = aumento (mostrar en verde: "+30%")
    - Negativo = descuento (mostrar en rojo: "-10%")
    - Placeholder: "ej: 30 para +30%, -10 para -10%"

  Aplica a tipos: checkboxes de tipos de habitación (todos marcados por defecto = aplica a todos)

  [Crear regla]
```

---

### 7.E — Actualizar navegación

En el componente de sidebar/navbar existente, bajo la sección de Habitaciones, agregar:
```
🏠 Habitaciones
  ├── Mapa / Lista    → /habitaciones  (ya existe)
  ├── Tipos           → /habitaciones/tipos    (solo gerente)
  └── Reglas de tarifa → /habitaciones/tarifas  (solo gerente)
```

En `App.jsx`, agregar las 2 rutas nuevas protegidas por rol gerente.

---

## ══════════════════════════════════════════
## MÓDULO 01 — CHECK-IN MANUAL
## ══════════════════════════════════════════

> Desarrolla DESPUÉS del Módulo 07. El Paso 1 reutiliza el mapa de habitaciones.

### Endpoints disponibles en el backend

```
GET  /api/v1/habitaciones/disponibles?fecha_entrada=&fecha_salida=&personas=
     → igual que GET /habitaciones pero solo las disponibles, con tarifa_sugerida

GET  /api/v1/clientes/reniec/:dni
     → { encontrado: bool, nombres, apellidos, fecha_nacimiento?, direccion? }
     → Si RENIEC no responde: { encontrado: false, timeout: true }

GET  /api/v1/clientes/sunat/:ruc
     → { encontrado: bool, razon_social, estado, condicion, direccion }

GET  /api/v1/huespedes?tipo_documento=dni&numero_documento=12345678
     → { encontrado: bool, huesped: { id, nombres, apellidos, email, telefono,
         total_estancias, ultima_visita, segmento_crm } | null }

POST /api/v1/huespedes
     → { id, is_returning: bool, nombres, apellidos, ... }

POST /api/v1/reservas/checkin-manual
     → { reserva_id, codigo_reserva, habitacion_numero, huesped_nombre,
         fecha_entrada, fecha_salida, total, comprobante_estado }
     Errores: 409 HABITACION_NO_DISPONIBLE | 409 CAPACIDAD_EXCEDIDA
              422 PAGOS_NO_COINCIDEN | 422 FECHAS_INVALIDAS
```

---

### 8.A — Crear `pages/checkin/CheckinManualPage.jsx`

Ruta: `/checkin` — Accesible para `rol === 'gerente'` y `rol === 'recepcionista'`

**Barra de progreso en la parte superior:**
```
[1 Habitación] ──── [2 Cliente] ──── [3 Pago] ──── [4 Comprobante] ──── [5 Confirmar]
```
- El paso actual resaltado en azul
- Los pasos completados con check verde
- Los pasos futuros en gris
- NO se puede hacer clic en un paso futuro
- SÍ se puede hacer clic en un paso ya completado para volver

**Estado global del wizard** (usar useState en el componente padre o useReducer):
```javascript
const [wizardData, setWizardData] = useState({
  // Paso 1
  habitacion: null,       // objeto habitacion seleccionada
  fecha_entrada: today,   // Date
  numero_noches: 1,       // int
  fecha_salida: tomorrow, // Date (calculada)
  numero_personas: 1,     // int
  precio_por_noche: 0,    // decimal (editable)
  total: 0,               // calculado

  // Paso 2
  tipo_documento: 'dni',
  numero_documento: '',
  huesped_id: null,       // UUID si ya existe en BD
  nombres: '',
  apellidos: '',
  email: '',
  telefono: '',
  is_returning: false,    // cliente recurrente

  // Paso 3
  pagos: [],              // [{ metodo, monto, referencia }]
  monto_recibido: 0,      // solo para efectivo

  // Paso 4
  tipo_comprobante: 'boleta',
  datos_facturacion: { ruc: '', razon_social: '', direccion: '', email: '' },
  canal_envio: 'whatsapp',
})
```

---

### PASO 1 — Selección de habitación

```jsx
// Layout:
// Columna izquierda (40%): campos de búsqueda
// Columna derecha (60%): mapa o lista de habitaciones disponibles

// COLUMNA IZQUIERDA — Parámetros de búsqueda:
Fecha de entrada:
  DatePicker, default: hoy, no permite fechas pasadas

Fecha de salida / Número de noches:
  Dos inputs sincronizados:
  - Al cambiar "noches": recalcula fecha_salida = entrada + noches
  - Al cambiar "fecha_salida": recalcula noches = salida - entrada
  - Validar: fecha_salida > fecha_entrada siempre
  - noches mínimo: 1

Número de personas:
  Input number, min=1, default=1

Botón "Buscar disponibilidad":
  → llama GET /api/v1/habitaciones/disponibles con los parámetros
  → mientras carga: spinner en la columna derecha

// COLUMNA DERECHA — Resultados:
Dos sub-tabs: [ Vista Mapa ] [ Vista Lista ]

Vista Mapa:
  Reutilizar HotelMap.jsx existente
  Solo mostrar las habitaciones disponibles (las ocupadas con opacidad reducida y no clickeables)
  Al hacer clic en una habitación disponible: seleccionar

Vista Lista:
  Cards de habitación, 2 por fila:
  ┌────────────────────────────────┐
  │ Hab. 201 — Doble        Piso 2 │
  │ 👥 2 adultos · 25m²            │
  │ WiFi · AC · TV · Frigobar      │
  │ S/ 120/noche (IA: S/ 145)      │
  │         [Seleccionar]          │
  └────────────────────────────────┘
  - Tarifa IA en verde si > tarifa_base, naranja si igual, no mostrar si no hay

Al seleccionar una habitación (en mapa o lista):
  Panel inferior deslizable que aparece (o columna izquierda cambia):
  ┌─────────────────────────────────────────┐
  │ ✅ Hab. 201 — Doble · Piso 2 seleccionada │
  │                                         │
  │ Precio por noche: [S/ ___________]      │ ← editable
  │ (Sugerido por IA: S/ 145)               │
  │                                         │
  │ 3 noches × S/ 145 = S/ 435 total        │ ← actualiza en tiempo real
  │ Check-out: sábado 24 de mayo            │ ← fecha en texto claro
  │                                         │
  │              [Continuar →]              │
  └─────────────────────────────────────────┘

Validación al continuar:
- número_personas <= habitacion.capacidad_adultos + habitacion.capacidad_ninos
- Si no: mostrar error "Esta habitación tiene capacidad para X personas máximo"
```

---

### PASO 2 — Datos del cliente

```jsx
// Layout en 2 columnas en pantallas grandes, 1 columna en tablet

// SECCIÓN BÚSQUEDA:
Tipo de documento:
  Select con opciones:
  - DNI (default)
  - RUC
  - Pasaporte
  - Carnet de Extranjería
  - Otro documento

Número de documento:
  Input text
  Placeholder dinámico según tipo:
    DNI → "12345678 (8 dígitos)"
    RUC → "20123456789 (11 dígitos)"
    Pasaporte → "Número de pasaporte"
    etc.
  Validación de formato antes de buscar (no al escribir, solo al hacer clic en Buscar)

Botón "Buscar":
  Lógica de búsqueda en 2 etapas:
  
  ETAPA 1: Buscar en la BD del hotel primero (sin llamada a RENIEC)
    GET /api/v1/huespedes?tipo_documento=X&numero_documento=Y
    
    Si encontrado (is_returning = true):
      → Banner VERDE: "✅ Cliente registrado — {X} visitas anteriores"
      → Rellenar todos los campos automáticamente (solo lectura)
      → Solo teléfono y email son editables (pueden haber cambiado)
      → Guardar huesped_id en el estado del wizard
      → NO llamar a RENIEC (ya tenemos los datos)
    
    Si NO encontrado en BD:
      → Proceder a ETAPA 2
  
  ETAPA 2: Buscar en RENIEC/SUNAT
    Solo si tipo = DNI: GET /api/v1/clientes/reniec/:dni
    Solo si tipo = RUC: GET /api/v1/clientes/sunat/:ruc
    
    Si encontrado en RENIEC/SUNAT:
      → Banner AZUL: "ℹ️ Datos obtenidos de RENIEC — completa los datos de contacto"
      → Pre-rellenar nombre y apellidos (solo lectura)
      → teléfono y email: vacíos y editables
      → huesped_id = null (se creará al continuar)
    
    Si timeout o error de RENIEC:
      → Banner GRIS: "⚠️ RENIEC no disponible — ingresa los datos manualmente"
      → Todos los campos editables y vacíos
    
    Si tipo = Pasaporte, Carnet u Otro:
      → No llamar a ninguna API externa
      → Banner GRIS directamente: "📝 Ingresa los datos del huésped"
      → Todos los campos editables

// FORMULARIO DE DATOS:
Mostrar siempre, debajo del banner:

Nombres:         input text, requerido
Apellidos:       input text, requerido
Email:           input email, opcional
Teléfono:        input tel, opcional
                 Placeholder: "+51 999 999 999"
Observaciones:   textarea, opcional, placeholder "Notas internas del recepcionista"

// Al hacer clic en "Continuar →":
POST /api/v1/huespedes con todos los datos
→ Si éxito: guardar huesped_id en el wizard state
→ Pasar al Paso 3
```

---

### PASO 3 — Método de pago

```jsx
// Encabezado con resumen:
┌──────────────────────────────────────────┐
│ Hab. 201 · {nombre_huesped}              │
│ {fecha_entrada} → {fecha_salida}         │
│ TOTAL A PAGAR: S/ {total}                │
└──────────────────────────────────────────┘

// Lista de pagos (empieza con 1 fila vacía):
Cada fila de pago:
  [Select método ▼]  [S/ ________]  [Referencia opcional]  [× eliminar]
  
  Métodos:
    💵 Efectivo
    📱 Yape
    📱 Plin
    💳 Tarjeta débito
    💳 Tarjeta crédito
    🏦 Transferencia

Botón "+ Agregar otro método de pago"

// Panel de totales (sticky al fondo o a la derecha):
Total a pagar:    S/ {total}
Total ingresado:  S/ {suma_de_pagos}  → verde si = total, rojo si ≠
Diferencia:       S/ {diferencia}     → mostrar solo si ≠ 0

// Si hay Efectivo en los métodos:
Mostrar sección extra debajo del panel de métodos:
  Monto recibido: [S/ _________]
  Vuelto:         S/ {monto_recibido - total}   ← rojo si negativo

// Validaciones al continuar:
- Debe haber al menos 1 método de pago
- Suma de montos debe ser >= total (tolerancia 0.01)
- Si suma > total: mostrar warning "El monto supera el total. ¿Es correcto?" con botón "Sí, continuar"
- Si suma < total: bloquear, mostrar "Faltan S/ X por cubrir"
```

---

### PASO 4 — Tipo de comprobante

```jsx
// Radio buttons principales:
( ) Boleta de venta
( ) Factura electrónica

// Si el huesped ingresó RUC en el Paso 2: pre-seleccionar Factura

// Sección condicional — se muestra SOLO si Factura está seleccionada:
┌─────────────────────────────────────────────┐
│ Datos para la factura                        │
│ RUC:          [___________] (pre-llenado si había RUC) │
│ Razón social: [___________________________] │
│ Dirección:    [___________________________] │
│ Email:        [___________________________] │
└─────────────────────────────────────────────┘

// Canal de envío del comprobante:
Enviar comprobante por:
  [✅] WhatsApp  (pre-marcado si huesped tiene teléfono)
  [ ] Correo     (pre-marcado si huesped tiene email)
  [ ] Solo imprimir

// Info: mostrar el número/email al que se enviará
Si WhatsApp marcado: "Se enviará a: +51 {telefono}"
Si Correo marcado: "Se enviará a: {email}"
```

---

### PASO 5 — Resumen y confirmación

```jsx
// Tarjeta de resumen completo:
┌──────────────────────────────────────────────────┐
│                  RESUMEN CHECK-IN                 │
├──────────────────────────────────────────────────┤
│ 🏠 HABITACIÓN                                     │
│    Hab. 201 — Doble · Piso 2                     │
│    Capacidad: 2 adultos                           │
├──────────────────────────────────────────────────┤
│ 👤 HUÉSPED                                        │
│    Carlos Roque Ríos                              │
│    DNI: 45123456                                  │
│    📱 +51 987 654 321                             │
├──────────────────────────────────────────────────┤
│ 📅 FECHAS                                         │
│    Entrada:  lunes 19 de mayo de 2025             │
│    Salida:   jueves 22 de mayo de 2025            │
│    Estadía:  3 noches                             │
│    CHECK-OUT: 22 de mayo a las 12:00              │  ← destacado
├──────────────────────────────────────────────────┤
│ 💰 PAGO                                           │
│    3 noches × S/ 145.00 = S/ 435.00               │
│    💵 Efectivo:  S/ 200.00                        │
│    📱 Yape:      S/ 235.00                        │
│    TOTAL:        S/ 435.00 ✅                     │
├──────────────────────────────────────────────────┤
│ 🧾 COMPROBANTE                                    │
│    Boleta de venta                                │
│    Envío: WhatsApp +51 987 654 321                │
└──────────────────────────────────────────────────┘

// Botones:
[← Modificar]                    [✅ Confirmar Check-in]

// Al hacer clic en "Confirmar Check-in":
1. Deshabilitar el botón inmediatamente
2. Mostrar spinner + "Procesando check-in..."
3. POST /api/v1/reservas/checkin-manual con todos los datos del wizard
4. Si 201 éxito → mostrar ModalCheckInExitoso
5. Si error → mostrar el mensaje del error, re-habilitar el botón

// Errores específicos que mostrar en texto claro:
409 HABITACION_NO_DISPONIBLE → "La habitación fue tomada mientras completabas el registro. Vuelve al Paso 1 para elegir otra."
409 CAPACIDAD_EXCEDIDA → "El número de personas supera la capacidad de esta habitación."
422 PAGOS_NO_COINCIDEN → "El total de los pagos no coincide con el monto de la reserva."
422 FECHAS_INVALIDAS → "Las fechas ingresadas no son válidas."
```

---

### Modal de Check-In Exitoso

```jsx
// Overlay oscuro + modal centrado
// Animación: check verde aparece con animación de escala

┌─────────────────────────────────┐
│          ✅                     │
│    Check-in registrado          │
│                                 │
│  Habitación: 201                │
│  Huésped: Carlos Roque Ríos     │
│  Código: RES-2025-0142          │
│  Check-out: 22 mayo · 12:00     │
│                                 │
│  Comprobante: enviando por WPP  │ ← o "enviado" si fue inmediato
│                                 │
│  [🖨️ Imprimir voucher]          │
│  [+ Nuevo check-in]             │
│  [Ver todas las reservas]       │
└─────────────────────────────────┘

// "Imprimir voucher": abrir ventana de impresión con los datos del check-in
// "Nuevo check-in": cerrar modal y resetear TODO el wizard state
// "Ver reservas": navegar a /reservas
```

---

### 8.B — Agregar ruta y acceso desde el header

En la barra de navegación existente:
- Agregar botón `[+ Check-in]` prominente (azul, visible para gerente y recepcionista)
- Al hacer clic: navegar a `/checkin`
- En App.jsx: agregar ruta `/checkin` protegida para roles `['gerente', 'recepcionista']`

---

## ══════════════════════════════════════════
## MÓDULO 03 — TURNO DE CAJA
## ══════════════════════════════════════════

> Desarrolla DESPUÉS del Módulo 01.

### Endpoints disponibles en el backend

```
POST /api/v1/turnos/abrir
     body: { tipo: "dia"|"noche", saldo_inicial: decimal }
     → { id, tipo, hora_apertura, recepcionista, saldo_inicial }
     error: 409 si ya hay turno abierto

GET  /api/v1/turnos/activo
     → { turno: { id, tipo, recepcionista, hora_apertura, saldo_inicial },
         resumen: { total_checkins, total_checkouts, total_efectivo, total_yape,
                    total_plin, total_tarjetas, total_transferencias,
                    total_general, total_gastos_caja, efectivo_neto,
                    saldo_final_proyectado } }
     → null si no hay turno abierto

POST /api/v1/turnos/:id/gastos
     body: { concepto, monto, comprobante_proveedor? }

GET  /api/v1/turnos/:id/gastos
     → [{ id, concepto, monto, comprobante_proveedor, registrado_por, created_at }]

POST /api/v1/turnos/:id/cerrar
     body: { pin: string }
     → { turno_id, hora_cierre, saldo_final, pdf_url }
     error: 401 si PIN incorrecto

GET  /api/v1/turnos/:id/reporte/pdf
     → application/pdf (descarga directa)

GET  /api/v1/turnos?page=&limit=&fecha=&tipo=&recepcionista_id=
     → { data: [turnos], total, page }
```

---

### 9.A — Crear `components/turno/TurnoWidget.jsx`

Widget que va en el **header principal** del dashboard (visible siempre para gerente y recepcionista).

```jsx
// Leer GET /api/v1/turnos/activo al montar
// Polling cada 60 segundos

// Si HAY turno abierto:
┌─────────────────────────────────────────────┐
│ 🟢 TURNO DÍA · desde 08:32  |  S/ 1,240.00 │
│                              |  [Ver turno] │
└─────────────────────────────────────────────┘
- Indicador verde pulsante
- Tipo del turno (DÍA o NOCHE)
- Hora desde la que está abierto
- Total acumulado del turno (total_general)
- Botón "Ver turno" → navega a /turno

// Si NO hay turno abierto:
┌──────────────────────────────────────────────┐
│ 🔴 Sin turno activo          [Abrir turno]   │
└──────────────────────────────────────────────┘
- Indicador rojo
- Botón "Abrir turno" → abre AbrirTurnoModal

// El widget nunca rompe el layout si el endpoint falla — mostrar estado neutral
```

---

### 9.B — Crear `components/turno/AbrirTurnoModal.jsx`

```jsx
// Modal centrado, simple

┌──────────────────────────────────┐
│        Abrir nuevo turno         │
├──────────────────────────────────┤
│ Tipo de turno:                   │
│   ◉ DÍA    (06:00 – 18:00)      │
│   ○ NOCHE  (18:00 – 06:00)      │
│                                  │
│ Saldo inicial en caja:           │
│   S/ [____________]              │
│   💡 Cuenta el efectivo físico   │
│      que hay en caja ahora       │
├──────────────────────────────────┤
│     [Cancelar]  [Abrir turno]    │
└──────────────────────────────────┘

// Pre-seleccionar el tipo según la hora actual:
// Si hora actual entre 06:00 y 17:59 → pre-seleccionar DÍA
// Si hora actual entre 18:00 y 05:59 → pre-seleccionar NOCHE

// Validación: saldo_inicial >= 0 (puede ser 0)

// Al confirmar: POST /api/v1/turnos/abrir
// Si éxito: cerrar modal, actualizar TurnoWidget, navegar a /turno
// Si 409 (ya hay turno abierto): mostrar "Ya hay un turno abierto. Ciérralo primero."
```

---

### 9.C — Crear `pages/turno/TurnoActivoPage.jsx`

Ruta: `/turno` — Accesible para `rol === 'gerente'` y `rol === 'recepcionista'`

```jsx
// Si no hay turno activo al entrar: redirigir al dashboard con mensaje
// "No hay un turno abierto. Abre un turno primero."

// Polling: GET /api/v1/turnos/activo cada 30 segundos
// Polling: GET /api/v1/turnos/:id/gastos cada 60 segundos

// HEADER de la página:
┌────────────────────────────────────────────────────────┐
│ TURNO DÍA 🟢  │  Apertura: 19/05 08:32  │  [Cerrar turno]  │
│ Recepcionista: Ana Torres                                │
└────────────────────────────────────────────────────────┘

// LAYOUT: 3 columnas en desktop, 1 columna en tablet

// COLUMNA IZQUIERDA (35%) — Transacciones del turno:
Título: "Movimientos del turno"
Tabla con scroll:
  Hora | Cliente | Hab. | Método | Monto
  ---- | ------- | ---- | ------ | -----
  09:14 | Carlos R. | 201 | Efectivo | S/ 435
  10:32 | María L. | 105 | Yape     | S/ 290

// COLUMNA CENTRAL (35%) — Gastos de caja:
Título: "Gastos de caja"

Formulario rápido de registro:
  Concepto: input text, placeholder "ej: Compra de papel"
  Monto: S/ input decimal
  Comprobante: input text, opcional, placeholder "Nro. factura del proveedor"
  [+ Registrar gasto]

Lista de gastos del turno (debajo del formulario):
  09:45 - Papel higiénico - S/ 15.00 ✕
  11:20 - Jabón líquido  - S/ 28.50 ✕

Total gastos: S/ 43.50

// COLUMNA DERECHA (30%) — Resumen en tiempo real:
Cards de resumen (actualizadas con el polling):

┌────────────────┐
│ 💵 Efectivo    │
│   S/ 635.00    │
└────────────────┘
┌────────────────┐
│ 📱 Yape + Plin │
│   S/ 290.00    │
└────────────────┘
┌────────────────┐
│ 💳 Tarjetas    │
│   S/ 0.00      │
└────────────────┘
┌────────────────────────────────┐
│ TOTAL TURNO                    │
│ S/ 925.00                      │
│ ─────────────────────────────  │
│ Saldo inicial:    S/ 200.00    │
│ Gastos caja:    - S/ 43.50     │
│ Efectivo neto:    S/ 191.50    │
│ ─────────────────────────────  │
│ SALDO FINAL CAJA: S/ 391.50    │
└────────────────────────────────┘

Check-ins: 2 · Check-outs: 0
```

---

### 9.D — Crear `components/turno/CerrarTurnoModal.jsx`

```jsx
// Modal de 2 pasos

// PASO 1 — Resumen antes de cerrar:
┌───────────────────────────────────────────┐
│          Cerrar turno DÍA                 │
├───────────────────────────────────────────┤
│ Resumen del turno:                        │
│   Check-ins realizados:    2              │
│   Check-outs realizados:   0              │
│   Total efectivo:    S/ 635.00            │
│   Total Yape/Plin:   S/ 290.00            │
│   Total tarjetas:    S/   0.00            │
│   Gastos de caja:  - S/  43.50            │
│   ─────────────────────────────           │
│   TOTAL TURNO:      S/ 925.00             │
│   SALDO FINAL CAJA: S/ 391.50             │
├───────────────────────────────────────────┤
│ Confirma tu contraseña para firmar:       │
│   [__________________________________]    │
│   (la misma con la que iniciaste sesión)  │
├───────────────────────────────────────────┤
│        [Cancelar]  [Cerrar y firmar]      │
└───────────────────────────────────────────┘

// PASO 2 (si POST /api/v1/turnos/:id/cerrar fue exitoso):
┌───────────────────────────────────────────┐
│          ✅ Turno cerrado                  │
│                                           │
│  Hora de cierre: 18:01                   │
│  Firmado por: Ana Torres                  │
│                                           │
│  [📄 Descargar PDF]                       │
│  [📱 Enviar resumen al grupo WPP]         │
│  [Ir al Dashboard]                        │
└───────────────────────────────────────────┘

// "Descargar PDF": GET /api/v1/turnos/:id/reporte/pdf
//   → Abrir con window.open(url) o crear un blob y descargarlo
// "Enviar al grupo WPP": POST /api/v1/notificaciones/grupo/turno
//   → Si no existe ese endpoint aún, mostrar "Esta función estará disponible pronto"
```

---

### 9.E — Crear `pages/turno/HistorialTurnosPage.jsx`

Ruta: `/turnos/historial` — Solo accesible para `rol === 'gerente'`

```jsx
// Header con filtros:
Fecha: date input
Tipo: select DÍA | NOCHE | Todos
Recepcionista: select (cargar lista desde /api/v1/personal?rol=recepcionista)
[Buscar]

// Tabla paginada (20 por página):
Fecha | Tipo | Recepcionista | Apertura | Cierre | Transacciones | Total | Acciones
─────────────────────────────────────────────────────────────────────────────────
19/05 | DÍA | Ana Torres | 08:32 | 18:01 | 8 | S/ 2,840 | [Ver PDF]
18/05 | NOCHE | Luis Ríos | 18:05 | 05:58 | 3 | S/ 980 | [Ver PDF]

// Paginación: [← Anterior] Página 1 de 5 [Siguiente →]

// "Ver PDF": GET /api/v1/turnos/:id/reporte/pdf → descargar
```

---

### 9.F — Actualizar navegación

En el sidebar/navbar existente:
```
💰 Turno de caja
  ├── Turno activo    → /turno
  └── Historial       → /turnos/historial  (solo gerente)
```

En App.jsx: agregar las 2 rutas nuevas.

---

## ORDEN DE DESARROLLO Y VERIFICACIÓN

```
1. Módulo 07:
   ✓ Tabs (Mapa/Lista) en Habitaciones.jsx
   ✓ HabitacionForm.jsx (modal con 4 tabs)
   ✓ TiposHabitacionPage.jsx
   ✓ ReglasTarifaPage.jsx
   ✓ Rutas en App.jsx
   ✓ Verificar: abrir /habitaciones, cambiar a lista, crear una habitación nueva

2. Módulo 01:
   ✓ CheckinManualPage.jsx con los 5 pasos
   ✓ Modal de éxito
   ✓ Botón [+ Check-in] en header
   ✓ Ruta en App.jsx
   ✓ Verificar: hacer un check-in completo de punta a punta

3. Módulo 03:
   ✓ TurnoWidget.jsx en el header
   ✓ AbrirTurnoModal.jsx
   ✓ TurnoActivoPage.jsx
   ✓ CerrarTurnoModal.jsx con descarga PDF
   ✓ HistorialTurnosPage.jsx
   ✓ Rutas en App.jsx
   ✓ Verificar: abrir turno → hacer check-in → ver turno → cerrar → descargar PDF
```

## CRITERIOS DE ÉXITO

El frontend está completo cuando:

- [ ] La lista de habitaciones muestra la tarifa sugerida por la IA sin romper si la IA no responde
- [ ] Se puede completar un check-in de 5 pasos sin errores con cliente nuevo y cliente recurrente
- [ ] La búsqueda por DNI existente muestra el banner verde y autocompleta correctamente
- [ ] Los pagos múltiples suman correctamente y muestran el vuelto para efectivo
- [ ] El TurnoWidget se actualiza solo cada 60 segundos sin recargar la página
- [ ] El PDF del reporte se descarga correctamente al cerrar el turno
- [ ] Un usuario con rol `recepcionista` NO puede ver /habitaciones/tipos, /habitaciones/tarifas, ni /turnos/historial
- [ ] En tablet de 1024px el wizard de check-in es completamente usable
- [ ] Ninguna página existente (Dashboard, Reservas, Revenue, CRM) fue rota
