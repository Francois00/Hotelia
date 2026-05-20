import re

with open(r'C:\Hotel-Proyecto\seed_hotelia.sql', 'r', encoding='utf-8') as f:
    content = f.read()

# ═══════════════════════════════════════════════════════════════════
# SECCIÓN 1: TIPOS_HABITACION (idempotent)
# ═══════════════════════════════════════════════════════════════════

content = content.replace('SET tipo_id = t.id', 'SET tipo_custom_id = t.id')
content = content.replace('WHERE h.tipo_id IS NULL', 'WHERE h.tipo_custom_id IS NULL')

# Fix UPDATE to use descripcion for tipo_custom_id matching
old_update = (
    "UPDATE habitaciones h\n"
    "SET tipo_custom_id = t.id\n"
    "FROM tipos_habitacion t\n"
    "WHERE h.tipo_custom_id IS NULL\n"
    "  AND LOWER(t.nombre) = h.tipo;"
)
new_update = (
    "UPDATE habitaciones h\n"
    "SET tipo_custom_id = t.id\n"
    "FROM tipos_habitacion t\n"
    "WHERE h.tipo_custom_id IS NULL\n"
    "  AND h.descripcion ILIKE '% — ' || t.nombre || '.%';"
)
content = content.replace(old_update, new_update)

# ═══════════════════════════════════════════════════════════════════
# SECCIÓN 2: HABITACIONES (idempotent)
# ═══════════════════════════════════════════════════════════════════

content = content.replace(
    '   amenities, estado, visible_otas, fuera_de_servicio)',
    '   amenidades, estado, visible_otas)'
)
content = content.replace("'disponible'", "'DISPONIBLE'")
content = content.replace("'matrimonial'", "'DOBLE'")
content = content.replace("'personal'",    "'SIMPLE'")
content = content.replace("'queen'",       "'DOBLE'")
content = content.replace("'triple'",      "'FAMILIAR'")
content = content.replace("'doble'",       "'DOBLE'")
content = re.sub(r', true, false\)', ', true)', content)

# ═══════════════════════════════════════════════════════════════════
# SECCIÓN 3: HUÉSPEDES
# ═══════════════════════════════════════════════════════════════════

# Fix column list
content = content.replace(
    '  (tipo_documento, numero_documento, nombres, apellidos, segmento_crm, total_estancias, gasto_total)',
    '  (tipo_documento, numero_documento, nombre, apellido, segmento, ltv)'
)

# Fix tipo_documento enum (uppercase)
content = content.replace("('dni',",       "('DNI',")
content = content.replace("('pasaporte',", "('PASAPORTE',")
content = content.replace("('ce',",        "('CE',")

# Fix segmento enum (uppercase) - only in huespedes VALUES rows
# Replace segmento values: last string before , N, ltv pattern
for old, new in [("'nuevo'", "'NUEVO'"), ("'recurrente'", "'RECURRENTE'"),
                 ("'ocasional'", "'OCASIONAL'"), ("'vip'", "'VIP'")]:
    content = content.replace(old, new)

# Drop total_estancias (integer at position 6, between segmento and ltv/gasto_total)
# Pattern: 'SEGMENTO', N, ltv_val)  ->  'SEGMENTO', ltv_val)
content = re.sub(
    r"('(?:NUEVO|RECURRENTE|OCASIONAL|VIP)'), (\d+), (\d+(?:\.\d+)?)\)",
    r"\1, \3)",
    content
)

# Fix ON CONFLICT UPDATE for huespedes
content = content.replace(
    "ON CONFLICT (numero_documento) DO UPDATE SET\n"
    "  total_estancias = EXCLUDED.total_estancias,\n"
    "  gasto_total     = EXCLUDED.gasto_total,\n"
    "  segmento_crm    = EXCLUDED.segmento_crm;",
    "ON CONFLICT (numero_documento) DO UPDATE SET\n"
    "  ltv      = EXCLUDED.ltv,\n"
    "  segmento = EXCLUDED.segmento;"
)

# ═══════════════════════════════════════════════════════════════════
# SECCIÓN 4: RESERVAS (idempotent)
# ═══════════════════════════════════════════════════════════════════

old_cols = ('(habitacion_id, huesped_id, canal, estado,\n'
            '   fecha_entrada, fecha_salida, numero_noches, numero_personas,\n'
            '   precio_por_noche, total, notas_internas)')
new_cols = ('(habitacion_id, huesped_id, canal, estado,\n'
            '   fecha_entrada, fecha_salida, adultos,\n'
            '   tarifa_acordada, notas)')
content = content.replace(old_cols, new_cols)

content = content.replace("'manual_recepcion'", "'DIRECTO'")
content = content.replace("'booking_com'",      "'BOOKING_COM'")
content = content.replace("'whatsapp'",         "'WHATSAPP'")
content = content.replace("'expedia'",          "'EXPEDIA'")
content = content.replace("'airbnb'",           "'AIRBNB'")

# Drop numero_noches (first integer after two dates on same line)
content = re.sub(
    r"('20\d{2}-\d{2}-\d{2}', '20\d{2}-\d{2}-\d{2}'), \d+, (\d+),",
    r"\1, \2,",
    content
)

# Drop total (second decimal before notes string + closing paren)
content = re.sub(
    r"(\d+(?:\.\d+)?), \d+(?:\.\d+)?, ((?:'[^']*'|-))(\s*\n\s*\))",
    r"\1, \2\3",
    content
)

# ═══════════════════════════════════════════════════════════════════

with open(r'C:\Hotel-Proyecto\seed_hotelia.sql', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done - seed fully fixed")
