-- =================================================================
-- SEED REAL DEL HOTEL — Hotelia
-- Generado desde DETALLE-HABITACIONES.xlsx e HISTORIAL-HAB.xlsx
-- 33 habitaciones · 192 huéspedes · 300 reservas históricas
-- Ejecutar: psql $DATABASE_URL -f seed_hotelia.sql
-- =================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────
-- SECCIÓN 1: TIPOS DE HABITACIÓN PERSONALIZADOS
-- ─────────────────────────────────────────────────────────────────
INSERT INTO tipos_habitacion (nombre, descripcion, color_mapa, activo) VALUES
  ('Matrimonial', 'Habitación con cama matrimonial de 2 plazas', '#ec4899', true),
  ('Personal',    'Habitación personal con cama de 1½ plazas',   '#6b7280', true),
  ('Queen',       'Habitación con cama queen size',               '#8b5cf6', true),
  ('Doble',       'Habitación doble con dos camas',               '#3b82f6', true),
  ('Triple',      'Habitación triple con tres camas',             '#f59e0b', true)
ON CONFLICT (nombre) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- SECCIÓN 2: HABITACIONES (33 habitaciones reales del hotel)
-- ─────────────────────────────────────────────────────────────────
INSERT INTO habitaciones
  (numero, piso, tipo, descripcion, capacidad_adultos, capacidad_ninos,
   tarifa_base, tarifa_minima, tarifa_maxima, moneda_tarifa,
   amenidades, estado, visible_otas)
VALUES
  ('201', 2, 'DOBLE', 'Hab. 201 — Doble. Baño privado. 2 PLAZAS, 1½ PLAZAS', 2, 0, 95.0, 85.0, 142.5, 'PEN', '["wifi","tv","ropero","ventana","bano_privado"]', 'DISPONIBLE', true),
  ('202', 2, 'DOBLE', 'Hab. 202 — Doble. Baño privado. 2 PLAZAS, 1½ PLAZAS', 2, 0, 100.0, 90.0, 150.0, 'PEN', '["wifi","tv","ropero","ventana","bano_privado"]', 'DISPONIBLE', true),
  ('203', 2, 'DOBLE', 'Hab. 203 — Doble. Baño privado. 2 PLAZAS, 1½ PLAZAS', 2, 0, 100.0, 90.0, 150.0, 'PEN', '["wifi","tv","agua_caliente","ropero","ventana","bano_privado"]', 'DISPONIBLE', true),
  ('301', 3, 'FAMILIAR', 'Hab. 301 — Triple. Baño privado. 2 PLAZAS, 1½ PLAZAS, 1½ PLAZAS', 3, 0, 120.0, 110.0, 180.0, 'PEN', '["wifi","agua_caliente","ropero","ventana","bano_privado"]', 'DISPONIBLE', true),
  ('302', 3, 'DOBLE', 'Hab. 302 — Doble. Baño privado. 1½ PLAZAS, 1½ PLAZAS', 2, 0, 100.0, 90.0, 150.0, 'PEN', '["wifi","tv","agua_caliente","ropero","ventana","bano_privado"]', 'DISPONIBLE', true),
  ('303', 3, 'FAMILIAR', 'Hab. 303 — Triple. Baño compartido. 1½ PLAZAS, 1½ PLAZAS, 1½ PLAZAS', 3, 0, 90.0, 80.0, 135.0, 'PEN', '["wifi","ropero","ventana","bano_compartido"]', 'DISPONIBLE', true),
  ('304', 3, 'DOBLE', 'Hab. 304 — Matrimonial. Baño compartido. 2 PLAZAS', 2, 0, 50.0, 45.0, 75.0, 'PEN', '["wifi","tv","ropero","ventana","bano_compartido"]', 'DISPONIBLE', true),
  ('305', 3, 'DOBLE', 'Hab. 305 — Matrimonial. Baño privado. 2 PLAZAS', 2, 0, 80.0, 60.0, 120.0, 'PEN', '["wifi","tv","agua_caliente","ropero","bano_privado"]', 'DISPONIBLE', true),
  ('306', 3, 'DOBLE', 'Hab. 306 — Matrimonial. Baño privado. 2 PLAZAS', 2, 0, 70.0, 60.0, 105.0, 'PEN', '["tv","agua_caliente","ropero","ventana","bano_privado"]', 'DISPONIBLE', true),
  ('307', 3, 'SIMPLE', 'Hab. 307 — Personal. Baño compartido. 1½ PLAZAS', 1, 0, 40.0, 30.0, 60.0, 'PEN', '["wifi","tv","ropero","ventana","escritorio","bano_compartido"]', 'DISPONIBLE', true),
  ('308', 3, 'DOBLE', 'Hab. 308 — Matrimonial. Baño compartido. 2 PLAZAS', 2, 0, 50.0, 45.0, 75.0, 'PEN', '["wifi","ropero","ventana","bano_compartido"]', 'DISPONIBLE', true),
  ('309', 3, 'SIMPLE', 'Hab. 309 — Personal. Baño compartido. 1½ PLAZAS', 1, 0, 40.0, 30.0, 60.0, 'PEN', '["wifi","tv","ropero","bano_compartido"]', 'DISPONIBLE', true),
  ('310', 3, 'DOBLE', 'Hab. 310 — Doble. Baño compartido. 1½ PLAZAS, 1½ PLAZAS', 2, 0, 60.0, 60.0, 90.0, 'PEN', '["wifi","tv","ropero","bano_compartido"]', 'DISPONIBLE', true),
  ('311', 3, 'SIMPLE', 'Hab. 311 — Personal. Baño compartido. 1½ PLAZAS', 1, 0, 40.0, 30.0, 60.0, 'PEN', '["wifi","tv","bano_compartido"]', 'DISPONIBLE', true),
  ('312', 3, 'DOBLE', 'Hab. 312 — Doble. Baño compartido. 2 PLAZAS, 1½ PLAZAS', 2, 0, 100.0, 90.0, 150.0, 'PEN', '["wifi","tv","ventana","bano_compartido"]', 'DISPONIBLE', true),
  ('313', 3, 'DOBLE', 'Hab. 313 — Doble. Baño compartido. 1½ PLAZAS, 1½ PLAZAS', 2, 0, 60.0, 60.0, 90.0, 'PEN', '["wifi","tv","ropero","ventana","bano_compartido"]', 'DISPONIBLE', true),
  ('314', 3, 'DOBLE', 'Hab. 314 — Queen. Baño privado. QUEEN', 2, 0, 100.0, 90.0, 150.0, 'PEN', '["wifi","tv","agua_caliente","ropero","ventana","bano_privado"]', 'DISPONIBLE', true),
  ('315', 3, 'DOBLE', 'Hab. 315 — Doble. Baño privado. 2 PLAZAS, 1½ PLAZAS', 2, 0, 90.0, 80.0, 135.0, 'PEN', '["wifi","ropero","ventana","bano_privado"]', 'DISPONIBLE', true),
  ('401', 4, 'DOBLE', 'Hab. 401 — Matrimonial. Baño privado. 2 PLAZAS', 2, 0, 80.0, 60.0, 120.0, 'PEN', '["wifi","tv","agua_caliente","ropero","ventana","escritorio","bano_privado"]', 'DISPONIBLE', true),
  ('402', 4, 'DOBLE', 'Hab. 402 — Matrimonial. Baño privado. 2 PLAZAS', 2, 0, 70.0, 60.0, 105.0, 'PEN', '["wifi","tv","ropero","ventana","escritorio","bano_privado"]', 'DISPONIBLE', true),
  ('403', 4, 'DOBLE', 'Hab. 403 — Doble. Baño privado. 2 PLAZAS, 1½ PLAZAS', 2, 0, 100.0, 90.0, 150.0, 'PEN', '["wifi","tv","agua_caliente","ropero","ventana","bano_privado"]', 'DISPONIBLE', true),
  ('404', 4, 'DOBLE', 'Hab. 404 — Doble. Baño privado. 2 PLAZAS, 1½ PLAZAS', 2, 0, 100.0, 90.0, 150.0, 'PEN', '["wifi","tv","agua_caliente","ropero","ventana","bano_privado"]', 'DISPONIBLE', true),
  ('405', 4, 'DOBLE', 'Hab. 405 — Matrimonial. Baño privado. 2 PLAZAS', 2, 0, 80.0, 60.0, 120.0, 'PEN', '["wifi","tv","agua_caliente","ropero","ventana","bano_privado"]', 'DISPONIBLE', true),
  ('406', 4, 'DOBLE', 'Hab. 406 — Matrimonial. Baño privado. 2 PLAZAS', 2, 0, 80.0, 60.0, 120.0, 'PEN', '["wifi","tv","agua_caliente","ropero","ventana","bano_privado"]', 'DISPONIBLE', true),
  ('407', 4, 'DOBLE', 'Hab. 407 — Matrimonial. Baño privado. 2 PLAZAS', 2, 0, 80.0, 60.0, 120.0, 'PEN', '["wifi","tv","agua_caliente","ropero","ventana","bano_privado"]', 'DISPONIBLE', true),
  ('408', 4, 'DOBLE', 'Hab. 408 — Matrimonial. Baño privado. 2 PLAZAS', 2, 0, 80.0, 60.0, 120.0, 'PEN', '["wifi","tv","agua_caliente","ropero","ventana","bano_privado"]', 'DISPONIBLE', true),
  ('409', 4, 'DOBLE', 'Hab. 409 — Matrimonial. Baño privado. 2 PLAZAS', 2, 0, 80.0, 60.0, 120.0, 'PEN', '["wifi","tv","agua_caliente","ropero","ventana","escritorio","bano_privado"]', 'DISPONIBLE', true),
  ('410', 4, 'SIMPLE', 'Hab. 410 — Personal. Baño privado. 1½ PLAZAS', 1, 0, 50.0, 50.0, 75.0, 'PEN', '["wifi","tv","agua_caliente","ropero","ventana","bano_privado"]', 'DISPONIBLE', true),
  ('411', 4, 'DOBLE', 'Hab. 411 — Matrimonial. Baño privado. 2 PLAZAS', 2, 0, 80.0, 60.0, 120.0, 'PEN', '["wifi","ropero","bano_privado"]', 'DISPONIBLE', true),
  ('412', 4, 'DOBLE', 'Hab. 412 — Matrimonial. Baño privado. 2 PLAZAS', 2, 0, 80.0, 60.0, 120.0, 'PEN', '["wifi","tv","ropero","ventana","bano_privado"]', 'DISPONIBLE', true),
  ('413', 4, 'DOBLE', 'Hab. 413 — Matrimonial. Baño privado. 2 PLAZAS', 2, 0, 80.0, 60.0, 120.0, 'PEN', '["wifi","tv","ropero","ventana","bano_privado"]', 'DISPONIBLE', true),
  ('414', 4, 'DOBLE', 'Hab. 414 — Matrimonial. Baño privado. 2 PLAZAS', 2, 0, 80.0, 60.0, 120.0, 'PEN', '["wifi","tv","agua_caliente","ropero","ventana","bano_privado"]', 'DISPONIBLE', true),
  ('415', 4, 'DOBLE', 'Hab. 415 — Matrimonial. Baño privado. 2 PLAZAS', 2, 0, 80.0, 60.0, 120.0, 'PEN', '["wifi","tv","ropero","ventana","escritorio","bano_privado"]', 'DISPONIBLE', true)
ON CONFLICT (numero) DO UPDATE SET
  tipo              = EXCLUDED.tipo,
  descripcion       = EXCLUDED.descripcion,
  capacidad_adultos = EXCLUDED.capacidad_adultos,
  capacidad_ninos   = EXCLUDED.capacidad_ninos,
  tarifa_base       = EXCLUDED.tarifa_base,
  tarifa_minima     = EXCLUDED.tarifa_minima,
  tarifa_maxima     = EXCLUDED.tarifa_maxima,
  moneda_tarifa     = EXCLUDED.moneda_tarifa,
  amenidades        = EXCLUDED.amenidades,
  estado            = EXCLUDED.estado,
  visible_otas      = EXCLUDED.visible_otas;

-- Asociar tipo_id (FK a tipos_habitacion)
UPDATE habitaciones h
SET tipo_custom_id = t.id
FROM tipos_habitacion t
WHERE h.tipo_custom_id IS NULL
  AND h.descripcion ILIKE '% — ' || t.nombre || '.%';

-- ─────────────────────────────────────────────────────────────────
-- SECCIÓN 3: HUÉSPEDES (192 clientes únicos)
-- ─────────────────────────────────────────────────────────────────
INSERT INTO huespedes
  (tipo_documento, numero_documento, nombre, apellido, segmento, ltv)
VALUES
  ('DNI', '71493780', 'RUTH MIRIAN', 'FIGUEROA TEJADA', 'NUEVO', 50.0),
  ('DNI', '46684444', 'ISBEN RODNEY', 'ROMERO LUQUE', 'NUEVO', 56.7),
  ('PASAPORTE', '23hf69455', 'SEVAN', 'LORDAN', 'NUEVO', 265.2),
  ('DNI', '44077419', 'JESUS BERNARDO', 'AYALA MEDINA', 'NUEVO', 140.0),
  ('DNI', '41611452', 'EDITH', 'VELASQUE ARBIETO', 'NUEVO', 199.0),
  ('DNI', '73778163', 'NAYELY MARIAPAZ', 'OTAZU BENAVENTE', 'NUEVO', 60.0),
  ('DNI', '80320097', 'FERNANDO', 'CANDIA BERROCAL', 'NUEVO', 80.0),
  ('DNI', '47365271', 'FELIX KENI', 'MUÑOZ VILLANUEVA', 'NUEVO', 250.5),
  ('DNI', '61165378', 'LEONARDO ALEXIS', 'ESPINOZA FLORENTINI', 'NUEVO', 70.0),
  ('DNI', '73810854', 'YUDEL STANLY', 'SALAS ARONI', 'RECURRENTE', 168.0),
  ('PASAPORTE', '22CA92182', 'GHULLAINE PLOQUIN', 'MANON MARIECLAUDE', 'NUEVO', 70.0),
  ('DNI', '47169636', 'DANIELA', 'ACHAHUE VENTURA', 'NUEVO', 50.0),
  ('DNI', '72040536', 'JENNIFER ISABEL', 'VENTURA SALINAS', 'NUEVO', 60.0),
  ('DNI', '44097291', 'JUAN CARLOS', 'ONAYRAMO CASTILLO', 'NUEVO', 60.0),
  ('DNI', '47466830', 'JAVIER ANTONI', 'CHALCO CALIZAYA', 'NUEVO', 110.5),
  ('DNI', '70599280', 'JOHAN JAIRO', 'LEON MALLQUI', 'NUEVO', 270.0),
  ('DNI', '72642986', 'MILENY ISELA', 'RAMON PALMA', 'NUEVO', 70.0),
  ('DNI', '9789251', 'CARLOS EDUARDO', 'BALDIVIAL CUSATI', 'OCASIONAL', 130.0),
  ('DNI', '46047807', 'ELVIS JHONATAN', 'CCOLQUE HUAIHUA', 'NUEVO', 70.0),
  ('DNI', '70412963', 'PEDRO LUIS', 'PARRA PARRA', 'NUEVO', 60.0),
  ('DNI', '73083182', 'BRYAN CRISTHOFER', 'ORQQUE FLORES', 'RECURRENTE', 140.0),
  ('DNI', '71794726', 'KARINA CINTIA', 'SOTO RABELO', 'NUEVO', 74.0),
  ('DNI', '47842922', 'DUSTIN GABRIEL', 'APAZA CHAVEZ', 'OCASIONAL', 119.1),
  ('DNI', '77032942', 'RUTH ESTHER', 'MAYANASA QUISPE', 'NUEVO', 78.1),
  ('DNI', '77162600', 'DANAE', 'CUBA PENEDO', 'VIP', 413.0),
  ('PASAPORTE', 'A16234063', 'MARIE', 'LOWE KALLEIGH', 'NUEVO', 70.0),
  ('DNI', '43384001', 'MIRIAM YNES', 'HUAMANI TITO', 'NUEVO', 50.0),
  ('DNI', '10748857', 'WALTER MARTIN', 'LAVALLE MAGALLANES', 'NUEVO', 74.0),
  ('DNI', '73665061', 'ORLANDO JORDANO', 'MELGAR NEGRON', 'NUEVO', 70.0),
  ('DNI', '73275534', 'ROEL DENNIS', 'TONCONI CONDORI', 'NUEVO', 70.0),
  ('DNI', '70791445', 'MAYER', 'JUCHATUMA AGUILAR', 'NUEVO', 70.0),
  ('DNI', '75514437', 'ELMER ELISEO', 'JUCHATUMA PAMPA', 'NUEVO', 70.0),
  ('DNI', '47650681', 'JUAN DAVID', 'HUAMANI MALCOACCHA', 'NUEVO', 40.0),
  ('DNI', '76965296', 'ZOLANYE YAMILIN', 'AQQUEPUCHO SOLIS', 'NUEVO', 70.0),
  ('DNI', '508066', 'LETICIA', 'VARGAS SILVA', 'NUEVO', 100.0),
  ('DNI', '40946951', 'MARIA VERONICA', 'VARGAS MAMANI', 'NUEVO', 98.2),
  ('PASAPORTE', 'C9VGW2NR7', 'HAHN', 'MIRKO', 'NUEVO', 67.26),
  ('DNI', '42095818', 'VALENTIN', 'TERRIZZANO AVALE', 'NUEVO', 100.0),
  ('DNI', '514645', 'DIANA PATRICIA', 'ZARZURI MOLINA', 'NUEVO', 120.0),
  ('DNI', '71848286', 'YENNY', 'JIMENEZ FERREL', 'OCASIONAL', 125.0),
  ('DNI', '72184150', 'JHOANNY JESUS', 'MORI ARMAS', 'NUEVO', 90.0),
  ('DNI', '60493606', 'ANGELO JOHAN', 'PEÑA GONZALES', 'RECURRENTE', 230.0),
  ('DNI', '79381116', 'THIFFANY KIARA', 'CHALLCO ZEGARRA', 'NUEVO', 100.0),
  ('DNI', '73819431', 'DANTE', 'SULCA CASTILLO', 'OCASIONAL', 105.0),
  ('DNI', '76410307', 'JOSEPH JEAN PIERRE', 'CEVALLOS GARCIA', 'NUEVO', 40.0),
  ('DNI', '42363874', 'CARLOS ALBERTO', 'PAZ CALIENES', 'NUEVO', 50.0),
  ('DNI', '40053278', 'MIGUEL ANGEL', 'MONCADA PACHECO', 'RECURRENTE', 376.3),
  ('DNI', '46771010', 'DIEGO ALEX', 'CAMPOS CARDENAS', 'VIP', 605.4),
  ('DNI', '72241616', 'JORGE ANTONIO', 'OSCCOLLA CCAMA', 'NUEVO', 100.0),
  ('DNI', '73884567', 'ALDO MANOLO', 'LUNA AYMA', 'NUEVO', 110.0),
  ('DNI', '73324256', 'VICTOR JAVIER', 'ZAMUDIO BEGUNZA', 'NUEVO', 60.0),
  ('DNI', '9847442', 'ELIANA MERCEDES', 'SORIANO PORTILLA', 'OCASIONAL', 105.0),
  ('DNI', '75796816', 'RENZO', 'MIRANDA NINAHUAMAN', 'RECURRENTE', 158.0),
  ('DNI', '48180397', 'ORLANDO JESUS', 'SANDOVAL ROMERO', 'NUEVO', 17.7),
  ('DNI', '17576811', 'FRANCISCO', 'GARCIA ROQUE', 'NUEVO', 50.0),
  ('DNI', '73517229', 'CRUZ BERNILLA RAUL', 'DE LA', 'NUEVO', 45.0),
  ('DNI', '70078109', 'JULIE MERELYN', 'ALVINO HUAMAN', 'NUEVO', 200.0),
  ('DNI', '71624509', 'BERTHA NELYTH', 'CASAS GAMBOA', 'NUEVO', 50.0),
  ('PASAPORTE', 'C9VGH648', 'ANTON', 'BURNER TOMAS', 'NUEVO', 110.0),
  ('DNI', '72900625', 'DANIELLE ALEXANDRA', 'ZUÑIGA VALERIO', 'OCASIONAL', 140.0),
  ('DNI', '16613830', 'REINALDA', 'CHAVEZ TASILLA', 'RECURRENTE', 210.0),
  ('DNI', '72265586', 'JAZZIRA MILUSKA', 'FLORES ZEBALLOS', 'NUEVO', 40.0),
  ('DNI', '72253933', 'PIERO GIANCARLO', 'CRUZ TATAJE', 'NUEVO', 50.0),
  ('DNI', '9927762', 'JORGE LUIS', 'LIÑAN ALVA', 'OCASIONAL', 130.0),
  ('DNI', '70468549', 'JUAN CARLOS MANUEL', 'MENDOZA CADILLO', 'NUEVO', 110.0),
  ('DNI', '18889465', 'CARLOS ALBERTO', 'SALAZAR ARMAS', 'RECURRENTE', 223.0),
  ('DNI', '78021193', 'LANDER ORLANDO', 'MANUYAMA HUAYNACARI', 'NUEVO', 31.9),
  ('DNI', '71016626', 'CRISTIAN AVEL', 'REPUELLO HUAROCC', 'NUEVO', 60.0),
  ('DNI', '46993528', 'RICHARD', 'PEREZ TAPIA', 'NUEVO', 120.0),
  ('PASAPORTE', 'KR3269630', 'CHADLEYEN', 'ABDEL WAHABAHMED', 'OCASIONAL', 120.0),
  ('DNI', '40830378', 'JOHNNY WALTER', 'MÜLLER RODRIGUEZ', 'RECURRENTE', 230.0),
  ('DNI', '45525714', 'JUAN CARLOS', 'PAPEL ACHAHUE', 'RECURRENTE', 150.0),
  ('DNI', '76576605', 'DIEGO', 'MENDOZA CACERES', 'NUEVO', 200.0),
  ('DNI', '75150429', 'DANIEL TEOFILO', 'SANDOVAL ASURZA', 'RECURRENTE', 251.0),
  ('DNI', '73880274', 'MARJORIE FERNANDA', 'FLORES ESPINOZA', 'RECURRENTE', 210.0),
  ('DNI', '60878675', 'TERRY JOSH', 'RODRIGUEZ VILLEGAS', 'VIP', 500.0),
  ('DNI', '76396409', 'GERSON TOMAS', 'ROMERO CORDOVA', 'NUEVO', 70.0),
  ('DNI', '63241418', 'GEANCARLO JAKU', 'AGUILAR INQUILTUPA', 'NUEVO', 35.0),
  ('DNI', '74320757', 'JORDAN BRAYAN', 'AYALA LAZARTE', 'NUEVO', 50.0),
  ('DNI', '48001383', 'MICHAEL JORDAN', 'GONZALES IBARRA', 'NUEVO', 70.0),
  ('DNI', '60840626', 'EMERSON', 'TACO CONDORI', 'NUEVO', 50.0),
  ('DNI', '77032886', 'OSCAR', 'CHAVEZ PACSI', 'NUEVO', 50.0),
  ('DNI', '77081999', 'CRISTHOFER ALEXANDER', 'BARRIGA PALOMINO', 'NUEVO', 220.0),
  ('DNI', '74824427', 'JESUS ORLANDO', 'SANTISTEBAN MORE', 'OCASIONAL', 160.0),
  ('DNI', '77063340', 'JAIRO OTNIEL', 'ATARAMA CORDOVA', 'NUEVO', 70.0),
  ('DNI', '70925264', 'JOSEPH PIERO', 'QUISPE BACA', 'NUEVO', 60.0),
  ('DNI', '17963434', 'BELTRAN CONSUELO', 'SALDAÑA DE', 'NUEVO', 60.0),
  ('DNI', '72110228', 'BRUCE ANTHONY', 'CAMAC POMA', 'RECURRENTE', 246.0),
  ('DNI', '46549858', 'JORGE LUIS', 'MARCAS PAQUIYAURI', 'OCASIONAL', 110.0),
  ('DNI', '77077611', 'LIVIA', 'GONZALES BENGOLEA', 'NUEVO', 60.0),
  ('DNI', '74076582', 'PEDRO DANIEL', 'SORIA PEREZ', 'RECURRENTE', 173.0),
  ('DNI', '47399187', 'ADBERLIN YABETH', 'COTRINA PAREDES', 'OCASIONAL', 110.0),
  ('DNI', '7641583', 'JAVIER RODOLFO', 'VERGARA MONTES', 'NUEVO', 60.0),
  ('DNI', '9154866', 'JHONNY ENRIQUE', 'POCATERRA LAVARTE', 'OCASIONAL', 140.0),
  ('DNI', '72554388', 'RONALD GERARDO', 'TICONA QUICAÑO', 'RECURRENTE', 184.0),
  ('DNI', '75745597', 'PERCY OMAR', 'LITANO SANDOVAL', 'NUEVO', 40.0),
  ('DNI', '76734674', 'JESUS MANUEL', 'HUAMANI PALACIOS', 'NUEVO', 50.0),
  ('DNI', '46167610', 'EBER', 'MAQQUERA QUISPE', 'NUEVO', 60.0),
  ('DNI', '48490809', 'NANDER', 'ACOSTA OYARCE', 'NUEVO', 70.0),
  ('DNI', '75007712', 'OLENKA SULEY', 'ESCALANTE RAMOS', 'OCASIONAL', 110.0),
  ('DNI', '71503069', 'NOLBERTO KEVIN', 'CABRERA CALDERON', 'OCASIONAL', 170.0),
  ('DNI', '21448783', 'FLOR MARIA', 'CALDERON GAMBOA', 'OCASIONAL', 140.0),
  ('DNI', '71384090', 'JUAN JOSEPH', 'PISCONTE GUERRERO', 'RECURRENTE', 193.5),
  ('DNI', '71335257', 'MANUEL ALEJANDRO', 'PEÑA LUNA', 'NUEVO', 120.0),
  ('DNI', '43005729', 'ELMER', 'ESPINOZA JACINTO', 'NUEVO', 110.0),
  ('DNI', '72934895', 'MARIO CARLO', 'ZANELLI DIAZ', 'NUEVO', 40.0),
  ('DNI', '29238977', 'ALEJANDRINA MANUELA', 'COAGUILA CRUZ', 'NUEVO', 126.0),
  ('DNI', '72631854', 'GLORIA SANDRA', 'VELASQUEZ CAYLLAHUA', 'NUEVO', 70.0),
  ('DNI', '44280852', 'ANGELA', 'LAURA VALENCIA', 'NUEVO', 60.0),
  ('DNI', '46518874', 'RUIZ FERNANDO', 'CASTILLO ARIZA', 'NUEVO', 70.0),
  ('DNI', '42593953', 'HENRY', 'HUICHI CAPIA', 'OCASIONAL', 120.0),
  ('DNI', '75448834', 'DANIEL FERNANDO', 'JIMENEZ CABRERA', 'NUEVO', 40.0),
  ('DNI', '72110223', 'CHRISTIAN JHONNY', 'PALOMINO ACOSTA', 'NUEVO', 50.0),
  ('DNI', '72476581', 'GILBERT AYMAR', 'PANUERA QUICAÑO', 'NUEVO', 220.0),
  ('DNI', '75820185', 'JOE ALESSANDRO', 'CAJALEON PEREZ', 'OCASIONAL', 177.4),
  ('DNI', '76209955', 'MICHAEL', 'RAMIREZ POCCO', 'OCASIONAL', 100.0),
  ('DNI', '72969639', 'JHOSMEL WILBERT', 'FARFAN VILLA', 'RECURRENTE', 290.0),
  ('DNI', '78803169', 'YEFRY ABELARDO', 'HUAMANI HUAMANI', 'NUEVO', 40.0),
  ('DNI', '72186658', 'STEFANO GABRIEL', 'HUACO CHACON', 'OCASIONAL', 200.0),
  ('DNI', '70106394', 'ALEXANDRA KRISTEL', 'SOLORZANO ALMONTE', 'OCASIONAL', 140.0),
  ('DNI', '25454573', 'GABRIELA ADELINA', 'ALMONTE CAFFO', 'OCASIONAL', 120.0),
  ('DNI', '2417479', 'PERCY CONCEPCION', 'PEREIRA CONDORI', 'NUEVO', 50.0),
  ('DNI', '15761994', 'JOSE ANDRES', 'JAUREGUI JIMENEZ', 'NUEVO', 60.0),
  ('DNI', '45281654', 'MARY CECILIA', 'PAREJA GARRIAZO', 'RECURRENTE', 170.0),
  ('DNI', '10049754', 'BENIGNO JORGE', 'REYES RODRIGUEZ', 'NUEVO', 60.0),
  ('DNI', '76460826', 'LESLY GIANINNA', 'HILARIO CHOQUE', 'OCASIONAL', 116.3),
  ('DNI', '72895576', 'OSCAR MANUEL', 'HUAMAN ALVARADO', 'NUEVO', 50.0),
  ('DNI', '21415583', 'MARIA JESUS', 'GUILLINTA HUAMAN', 'NUEVO', 50.0),
  ('DNI', '435229', 'GERMAN LUIS', 'COILA MAMANI', 'OCASIONAL', 172.6),
  ('DNI', '70937925', 'HECTOR CRISTIAN', 'SOSA ACHAHUI', 'OCASIONAL', 150.0),
  ('DNI', '76882548', 'MARIA ELIZABETH', 'RIZGO AQUINO', 'NUEVO', 100.0),
  ('DNI', '71693365', 'LUIS MANUEL', 'CHACÓN HUANQUI', 'NUEVO', 50.0),
  ('DNI', '73967955', 'ERICKSON BRAYAN', 'ROSAS PACHECO', 'OCASIONAL', 100.0),
  ('DNI', '77028950', 'MILTON OLMEDO', 'HUARACC PALOMINO', 'NUEVO', 50.0),
  ('DNI', '46450318', 'JIMMY', 'AYMITUMA LAUCATA', 'OCASIONAL', 110.0),
  ('DNI', '70975711', 'JESUS MAURICIO', 'PAHUARA ARANGO', 'NUEVO', 60.0),
  ('DNI', '70333861', 'ALAN DARYN STEVEN', 'CENTENO BELLO', 'NUEVO', 40.0),
  ('DNI', '21547741', 'ALEX WALTER', 'LOVERA CACERES', 'NUEVO', 50.0),
  ('DNI', '60968076', 'DANIELA SOFIA', 'QUISPE HUAMANI', 'NUEVO', 50.0),
  ('DNI', '73187947', 'HANS YAM', 'TANG CALDERON', 'OCASIONAL', 130.0),
  ('DNI', '73269045', 'RENE ROGER', 'HUAMANE HUAMANI', 'NUEVO', 40.0),
  ('DNI', '74178707', 'LEIDY DORIS', 'CCORI QUISPE', 'NUEVO', 45.0),
  ('DNI', '42905551', 'TEODORO ALEJANDRO', 'ACUÑA GONZALES', 'OCASIONAL', 120.0),
  ('DNI', '75873202', 'WILMER FRAMK', 'AZA HURTADO', 'OCASIONAL', 80.0),
  ('DNI', '46968706', 'VERONICA LISET', 'PALMA GUERRERO', 'OCASIONAL', 310.0),
  ('DNI', '75713301', 'JOSE FRANCISCO', 'LLATA SOTO', 'NUEVO', 60.0),
  ('DNI', '72035048', 'EDGAR ANDRÉ ALEJANDRO', 'YABARRENA RAMOS', 'NUEVO', 66.3),
  ('DNI', '8309398', 'RICHARD GUSTAVO', 'SALAZAR PONCE', 'OCASIONAL', 100.0),
  ('DNI', '22410449', 'EULELIO', 'TOLENTINO CALERO', 'NUEVO', 50.0),
  ('DNI', '20057710', 'JENNY GEOVANNA', 'CUESTAS SILVERA', 'NUEVO', 70.0),
  ('DNI', '74444320', 'YERSON ROMAN', 'QUISPE CHARCA', 'NUEVO', 60.0),
  ('RUC', '20111864595', 'S.A.C.', 'JS INDUSTRIAL', 'NUEVO', 60.0),
  ('DNI', '61258313', 'CAMILA ESTEFANI', 'GUTIERREZ MONTESINOS', 'NUEVO', 50.0),
  ('DNI', '76431998', 'DERLY ADONIS', 'PUMA LEON', 'NUEVO', 120.0),
  ('DNI', '73540225', 'WILBERT ANGEL', 'CCAPIA PALERO', 'NUEVO', 40.0),
  ('DNI', '70995987', 'MIGUEL ANGEL', 'TORRES NAVARRO', 'NUEVO', 50.0),
  ('DNI', '75980053', 'JOSE JAVIER', 'LAYME CHATA', 'NUEVO', 70.0),
  ('DNI', '48235102', 'LA CRUZ GUSTAVO LUCAS', 'BENIQUE DE', 'NUEVO', 60.0),
  ('DNI', '61048754', 'FAVIO ALESSANDRO', 'HUAMANI VILCA', 'NUEVO', 70.0),
  ('DNI', '46933142', 'FRECIA GIADIRA', 'TOLEDO MONTERROSO', 'NUEVO', 70.0),
  ('DNI', '48699650', 'WILY', 'CANAHUIRE CAHUANA', 'NUEVO', 40.0),
  ('DNI', '72023153', 'DIEGO CARLO', 'CORNEJO PAEZ', 'OCASIONAL', 365.0),
  ('DNI', '72274610', 'DIEGO EMANUEL', 'MAMANI CRUZ', 'NUEVO', 60.0),
  ('DNI', '46389545', 'JOEL CALEB', 'GIRON ARIAS', 'NUEVO', 50.0),
  ('DNI', '46174022', 'ESLI MELISA', 'VELASQUEZ MAURICIO', 'OCASIONAL', 115.0),
  ('DNI', '21442178', 'JULIO GENARO', 'RODRIGUEZ APARCANA', 'NUEVO', 40.0),
  ('DNI', '47924697', 'LUZ DELIS', 'CAVANACONZA INFANZON', 'OCASIONAL', 115.0),
  ('DNI', '48065140', 'WENDY ELIZABETH', 'CHECASACA MUÑOZ', 'RECURRENTE', 145.4),
  ('DNI', '492987', 'SILVANA CAROL', 'ALCALA QUELOPANA', 'NUEVO', 70.0),
  ('DNI', '41658010', 'ROXANA VANESSA', 'SANTOS TINEO', 'RECURRENTE', 180.0),
  ('DNI', '45821448', 'GIOVANNA KATHERINE', 'ESPINOZA SAAVEDRA', 'RECURRENTE', 217.4),
  ('DNI', '46948573', 'LUIS ANTONY', 'BARRIOS ARESTEGUI', 'NUEVO', 40.0),
  ('DNI', '9987844', 'ERICK LEONIDAS', 'CARRASCO HUARACHE', 'OCASIONAL', 110.0),
  ('DNI', '71417733', 'GABRIELA ALEJANDRA', 'BERNEDO BACKUS', 'NUEVO', 60.0),
  ('DNI', '46822541', 'YAN CARLOS', 'VEGA VERDE', 'NUEVO', 50.0),
  ('DNI', '74375004', 'ROYER MAGNO', 'PORTELLA RIVERA', 'NUEVO', 60.0),
  ('DNI', '61826551', 'CRISTHIAN ANGELO', 'TORRES GIL', 'NUEVO', 60.0),
  ('DNI', '74471189', 'BRADSON ELOY', 'PAUCA VILLENA', 'NUEVO', 60.0),
  ('DNI', '15696062', 'JUAN MANUEL', 'ROMERO PALMA', 'RECURRENTE', 160.0),
  ('DNI', '45144088', 'CHRISTHIAM ALBERTO', 'CHUNGA CABEZAS', 'OCASIONAL', 130.0),
  ('PASAPORTE', '627543890N', 'CASTILLO', 'MENDOZA LIUSA', 'NUEVO', 40.0),
  ('DNI', '514024', 'JOSE MARTIN', 'SULLCA HUISA', 'NUEVO', 60.0),
  ('DNI', '29617882', 'ALEX EDWARD', 'WAGNER ROSADO', 'NUEVO', 0.0),
  ('DNI', '72558462', 'MARIANELA YESSENIA', 'SANTISTEBAN VALDERA', 'RECURRENTE', 150.0),
  ('DNI', '70464764', 'BERTHA', 'CHUI HUAHUACONDORI', 'NUEVO', 70.0),
  ('DNI', '47382163', 'ALEXANDER OMAR', 'ABANTO GAMARRA', 'NUEVO', 40.0),
  ('DNI', '72216534', 'AIMAR', 'MORALES GARCIA', 'NUEVO', 70.0),
  ('DNI', '76000203', 'DAYANE NICOLE', 'CALDERON VALDIVIA', 'NUEVO', 90.0),
  ('DNI', '22486705', 'SALOMON MARTIN', 'ESPINOZA ORTIZ', 'OCASIONAL', 150.0),
  ('DNI', '10867033', 'ESTILL KENY', 'GUINET CABRAL', 'NUEVO', 70.0),
  ('DNI', '47025327', 'RENZO ALEJANDRO', 'LIZA LUMBRE', 'NUEVO', 90.0),
  ('DNI', '75575325', 'EDERSON JOSE', 'RODRIGUEZ GONZALES', 'NUEVO', 80.0)
ON CONFLICT (numero_documento) DO UPDATE SET
  ltv      = EXCLUDED.ltv,
  segmento = EXCLUDED.segmento;

-- ─────────────────────────────────────────────────────────────────
-- SECCIÓN 4: RESERVAS HISTÓRICAS (300 registros reales)
-- ─────────────────────────────────────────────────────────────────
INSERT INTO reservas
  (habitacion_id, huesped_id, canal, estado,
   fecha_entrada, fecha_salida, adultos,
   tarifa_acordada, notas)
VALUES
  (
    (SELECT id FROM habitaciones WHERE numero='308' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='71493780' LIMIT 1),
    'DIRECTO', 'CHECKIN_REALIZADO',
    '2026-05-19', '2026-05-20', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='408' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46684444' LIMIT 1),
    'WHATSAPP', 'CHECKIN_REALIZADO',
    '2026-05-19', '2026-05-20', 2,
    56.7, 'RESERVA WHATSAPP POR HORAS'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='313' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='23hf69455' LIMIT 1),
    'BOOKING_COM', 'CHECKIN_REALIZADO',
    '2026-05-19', '2026-05-20', 2,
    265.2, 'RESERVA BOOKING'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='301' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='44077419' LIMIT 1),
    'WHATSAPP', 'CHECKIN_REALIZADO',
    '2026-05-19', '2026-05-21', 2,
    70.0, 'RESERVA WHATSAPP'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='415' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='41611452' LIMIT 1),
    'WHATSAPP', 'CHECKIN_REALIZADO',
    '2026-05-19', '2026-05-21', 2,
    99.5, 'RESERVA WHATSAPP'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='405' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73778163' LIMIT 1),
    'DIRECTO', 'CHECKIN_REALIZADO',
    '2026-05-19', '2026-05-22', 2,
    20.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='407' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='80320097' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-18', '2026-05-19', 2,
    80.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='309' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='47365271' LIMIT 1),
    'DIRECTO', 'CHECKIN_REALIZADO',
    '2026-05-18', '2026-05-20', 2,
    125.25, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='305' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='61165378' LIMIT 1),
    'BOOKING_COM', 'CHECKIN_REALIZADO',
    '2026-05-18', '2026-05-22', 1,
    17.5, 'RESERVA BOOKING'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='406' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73810854' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-18', '2026-05-18', 2,
    63.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='306' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='22CA92182' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-18', '2026-05-19', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='409' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='47169636' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-18', '2026-05-19', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='408' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72040536' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-17', '2026-05-18', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='313' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='44097291' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-17', '2026-05-18', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='415' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='47466830' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-17', '2026-05-18', 2,
    110.5, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='410' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='70599280' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-17', '2026-05-19', 2,
    135.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='202' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72642986' LIMIT 1),
    'DIRECTO', 'CHECKIN_REALIZADO',
    '2026-05-17', '2026-05-20', 2,
    23.33, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='406' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73810854' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-17', '2026-05-17', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='401' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='9789251' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-17', '2026-05-17', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='408' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46047807' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-17', '2026-05-17', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='413' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='70412963' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-17', '2026-05-17', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='305' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73083182' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-17', '2026-05-17', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='309' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='71794726' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-17', '2026-05-17', 2,
    74.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='412' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='47842922' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-16', '2026-05-17', 2,
    49.1, 'pago con tarjeta'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='308' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='77032942' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-16', '2026-05-17', 2,
    78.1, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='411' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='77162600' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-16', '2026-05-17', 2,
    53.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='304' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='A16234063' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-16', '2026-05-17', 2,
    70.0, 'TARJETA'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='414' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='43384001' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-16', '2026-05-17', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='415' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='10748857' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-16', '2026-05-17', 2,
    74.0, 'POR HORAS'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='414' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73665061' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-16', '2026-05-17', 2,
    70.0, 'pago con tarjeta'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='413' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73275534' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-15', '2026-05-16', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='412' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='77162600' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-15', '2026-05-16', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='410' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='70791445' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-15', '2026-05-16', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='408' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75514437' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-15', '2026-05-16', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='406' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73810854' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-15', '2026-05-16', 2,
    55.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='411' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='77162600' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-15', '2026-05-16', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='405' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='47650681' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-15', '2026-05-16', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='307' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='76965296' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-15', '2026-05-16', 1,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='407' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='508066' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-15', '2026-05-16', 2,
    100.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='305' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='40946951' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-14', '2026-05-15', 2,
    98.2, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='315' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='C9VGW2NR7' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-14', '2026-05-15', 2,
    67.26, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='304' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='42095818' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-14', '2026-05-16', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='302' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='514645' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-14', '2026-05-17', 2,
    40.0, 'PAGO EN DOLARES'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='403' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='71848286' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-14', '2026-05-15', 2,
    55.0, 'RENOVACIÓN'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='301' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72184150' LIMIT 1),
    'WHATSAPP', 'CHECKOUT_REALIZADO',
    '2026-05-14', '2026-05-15', 2,
    90.0, 'RESERVA WHATSAPP'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='411' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='77162600' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-14', '2026-05-15', 1,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='414' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='60493606' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-14', '2026-05-15', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='409' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='79381116' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-13', '2026-05-14', 2,
    100.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='411' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='77162600' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-13', '2026-05-14', 2,
    100.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='308' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73819431' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-13', '2026-05-14', 2,
    55.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='403' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='71848286' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-13', '2026-05-14', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='404' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='76410307' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-13', '2026-05-14', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='410' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='77162600' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-13', '2026-05-14', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='415' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='42363874' LIMIT 1),
    'WHATSAPP', 'CHECKOUT_REALIZADO',
    '2026-05-13', '2026-05-14', 2,
    50.0, 'RESERVA WHATSAPP'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='309' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='40053278' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-13', '2026-05-14', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='411' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46771010' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-13', '2026-05-13', 2,
    110.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='409' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46771010' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-13', '2026-05-13', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='301' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46771010' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-13', '2026-05-13', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='312' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72241616' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-12', '2026-05-13', 2,
    100.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='311' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73884567' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-12', '2026-05-13', 2,
    110.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='314' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73324256' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-12', '2026-05-13', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='406' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='9847442' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-12', '2026-05-14', 2,
    30.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='203' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75796816' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-12', '2026-05-13', 2,
    63.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='408' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='48180397' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-12', '2026-05-13', 2,
    17.7, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='405' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='17576811' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-12', '2026-05-13', 2,
    50.0, 'PAGO CON TARJETA SE LE COBRÓ MÁS EL 5%'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='401' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73517229' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-12', '2026-05-13', 2,
    45.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='305' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='70078109' LIMIT 1),
    'BOOKING_COM', 'CHECKOUT_REALIZADO',
    '2026-05-12', '2026-05-13', 2,
    200.0, 'BOOKING .PAGO EN DÓLARES'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='304' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='71624509' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-12', '2026-05-13', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='414' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='60493606' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-12', '2026-05-13', 2,
    60.0, 'RENOVACIÓN'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='302' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='C9VGH648' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-12', '2026-05-14', 3,
    55.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='411' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46771010' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-11', '2026-05-12', 2,
    55.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='409' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46771010' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-11', '2026-05-12', 2,
    85.2, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='301' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46771010' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-11', '2026-05-12', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='406' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='9847442' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-11', '2026-05-12', 2,
    45.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='404' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72900625' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-11', '2026-05-12', 3,
    100.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='306' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='16613830' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-11', '2026-05-12', 2,
    100.0, 'RENOVACIÓN'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='414' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='60493606' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-11', '2026-05-12', 2,
    120.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='415' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72265586' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-10', '2026-05-12', 2,
    20.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='412' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72253933' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-10', '2026-05-12', 2,
    25.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='413' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='9927762' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-10', '2026-05-12', 2,
    30.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='307' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='70468549' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-10', '2026-05-11', 2,
    110.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='411' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46771010' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-10', '2026-05-11', 2,
    85.2, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='409' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46771010' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-10', '2026-05-11', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='301' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46771010' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-10', '2026-05-11', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='201' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72900625' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-10', '2026-05-11', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='305' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='18889465' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-09', '2026-05-10', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='304' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='78021193' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-09', '2026-05-10', 2,
    31.9, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='307' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='71016626' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-09', '2026-05-10', 1,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='309' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46993528' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-09', '2026-05-10', 1,
    120.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='407' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='KR3269630' LIMIT 1),
    'EXPEDIA', 'CHECKOUT_REALIZADO',
    '2026-05-09', '2026-05-11', 1,
    30.0, 'RESERVA EXPEDIA COLLECT PAGÓ EN DÓLARES'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='407' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='KR3269630' LIMIT 1),
    'EXPEDIA', 'CHECKOUT_REALIZADO',
    '2026-05-09', '2026-05-11', 1,
    30.0, 'RESERVA EXPEDIA'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='401' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='40830378' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-09', '2026-05-10', 2,
    40.0, 'RENOVACIÓN'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='306' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='16613830' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-09', '2026-05-11', 2,
    25.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='406' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='16613830' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-09', '2026-05-11', 2,
    30.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='413' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='9927762' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-09', '2026-05-10', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='402' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='45525714' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-09', '2026-05-09', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='405' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='76576605' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-08', '2026-05-09', 2,
    200.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='402' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='45525714' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-08', '2026-05-09', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='402' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='45525714' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-08', '2026-05-09', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='414' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75150429' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-08', '2026-05-09', 2,
    50.0, 'RENOVACIÓN'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='401' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='40830378' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-08', '2026-05-09', 2,
    40.0, 'RENOVACIÓN'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='314' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73880274' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-08', '2026-05-09', 2,
    50.0, 'RENOVACION'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='311' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='60878675' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-08', '2026-05-09', 2,
    50.0, 'RENOVACION'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='410' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='76396409' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-08', '2026-05-12', 2,
    17.5, 'pago con tarjeta se le agregó mas el 5%'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='301' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75796816' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-08', '2026-05-08', 4,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='309' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='63241418' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-08', '2026-05-08', 2,
    35.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='301' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75796816' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-08', '2026-05-09', 2,
    35.0, 'debe 70 soles'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='311' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='60878675' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-07', '2026-05-08', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='414' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75150429' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-07', '2026-05-08', 1,
    81.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='408' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='74320757' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-07', '2026-05-08', 2,
    50.0, 'POR HORAS'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='401' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='40830378' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-07', '2026-05-08', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='306' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='40830378' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-07', '2026-05-08', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='314' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73880274' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-07', '2026-05-08', 2,
    50.0, 'RENOVACION'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='401' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='40830378' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-07', '2026-05-07', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='309' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='48001383' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-07', '2026-05-07', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='407' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='60840626' LIMIT 1),
    'BOOKING_COM', 'CHECKOUT_REALIZADO',
    '2026-05-06', '2026-05-07', 2,
    50.0, 'RESERVA DE BOOKING'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='308' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73819431' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-06', '2026-05-07', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='406' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='77032886' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-06', '2026-05-06', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='311' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='60878675' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-06', '2026-05-07', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='314' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73880274' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-06', '2026-05-07', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='304' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='77081999' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-06', '2026-05-07', 2,
    220.0, 'POR HORAS'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='412' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='74824427' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-06', '2026-05-07', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='413' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='18889465' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-06', '2026-05-07', 2,
    63.0, 'POR HORAS'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='413' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='18889465' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-06', '2026-05-07', 2,
    70.0, 'POR HORAS'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='408' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='77063340' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-06', '2026-05-07', 2,
    70.0, 'POR HORAS'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='413' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='18889465' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-06', '2026-05-07', 2,
    50.0, 'POR HORAS'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='414' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75150429' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-06', '2026-05-07', 2,
    55.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='401' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75150429' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-06', '2026-05-07', 2,
    65.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='402' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='70925264' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-05', '2026-05-05', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='410' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='74824427' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-05', '2026-05-06', 1,
    100.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='415' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='17963434' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-05', '2026-05-09', 2,
    15.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='305' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72110228' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-05', '2026-05-06', 2,
    50.0, 'RENOVACIÓN'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='413' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46549858' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-05', '2026-05-06', 2,
    60.0, 'RENOVACION, PAGO MAS EL 5% DE COMISION DE PAGO POR TARJETA'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='314' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73880274' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-05', '2026-05-06', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='310' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='77077611' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-05', '2026-05-05', 3,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='411' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='74076582' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-04', '2026-05-04', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='408' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='47399187' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-04', '2026-05-06', 2,
    30.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='408' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='47399187' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-04', '2026-05-05', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='413' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46549858' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-04', '2026-05-05', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='302' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='7641583' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-04', '2026-05-05', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='305' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72110228' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-04', '2026-05-05', 2,
    70.0, 'RENOVACION'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='410' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='60878675' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-04', '2026-05-05', 2,
    40.0, 'RENOVACION'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='308' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='9154866' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-04', '2026-05-04', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='407' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72554388' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-04', '2026-05-05', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='415' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72554388' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-04', '2026-05-05', 2,
    74.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='412' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75745597' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-03', '2026-05-04', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='410' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='60878675' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-03', '2026-05-04', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='409' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='76734674' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-03', '2026-05-04', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='306' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46167610' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-03', '2026-05-04', 2,
    60.0, 'x horas'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='201' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='48490809' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-03', '2026-05-04', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='315' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73083182' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-03', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='407' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75007712' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-03', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='401' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='71503069' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-03', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='311' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='21448783' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-03', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='412' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='71384090' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-03', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='404' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='71335257' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-03', 2,
    120.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='309' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='60878675' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-03', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='310' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='43005729' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-03', 2,
    110.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='410' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72934895' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-03', 1,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='405' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='29238977' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-03', 2,
    126.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='305' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72110228' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-04', 2,
    63.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='408' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72631854' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-03', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='307' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='44280852' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-03', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='415' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46518874' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-03', 2,
    70.0, 'POR HORAS'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='413' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='42593953' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-03', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='411' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75448834' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-03', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='308' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='9154866' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-03', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='305' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72110223' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-04', 2,
    25.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='406' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72554388' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-03', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='312' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72476581' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-02', 2,
    220.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='308' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75820185' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-02', '2026-05-02', 2,
    100.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='302' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='76209955' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-03', 2,
    25.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='403' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72969639' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-03', 2,
    45.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='413' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='42593953' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='408' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='78803169' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='409' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72186658' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    140.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='406' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72969639' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-03', 2,
    35.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='411' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='76209955' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-03', 2,
    25.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='406' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72969639' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    130.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='311' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='21448783' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='401' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='71503069' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    100.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='407' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75007712' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='412' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='71384090' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    73.5, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='409' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='71384090' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='415' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='70106394' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    100.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='301' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='25454573' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-03', 2,
    35.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='305' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='70106394' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='301' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='25454573' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='404' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='2417479' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 3,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='402' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='15761994' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='202' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='45281654' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='410' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='10049754' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='307' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='40053278' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='310' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='76460826' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='414' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72895576' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-03', 2,
    25.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='304' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='60878675' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='306' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='21415583' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-03', 2,
    25.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='404' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='435229' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-01', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='203' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='70937925' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-01', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='405' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='76882548' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    100.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='203' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='70937925' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    90.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='305' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='71693365' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-01', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='411' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73967955' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-05-01', '2026-05-02', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='402' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='47842922' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-30', '2026-05-01', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='310' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='76460826' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-30', '2026-05-01', 2,
    66.3, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='307' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='40053278' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-30', '2026-05-01', 2,
    66.3, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='410' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='77028950' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-30', '2026-05-01', 1,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='314' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46450318' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-30', '2026-05-01', 2,
    50.0, 'RENOVACION'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='304' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='60878675' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-30', '2026-05-01', 2,
    150.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='407' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='70975711' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-30', '2026-04-30', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='412' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='70333861' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-30', '2026-04-30', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='404' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='435229' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-29', '2026-04-30', 2,
    132.6, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='402' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='40053278' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-29', '2026-04-30', 2,
    200.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='410' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='21547741' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-29', '2026-04-30', 1,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='411' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='60968076' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-29', '2026-04-30', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='311' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73187947' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-29', '2026-04-30', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='307' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73187947' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-29', '2026-04-30', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='314' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46450318' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-29', '2026-04-30', 1,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='404' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73269045' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-28', '2026-04-29', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='302' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='45281654' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-28', '2026-04-29', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='403' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='45281654' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-28', '2026-04-29', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='304' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='74178707' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-28', '2026-04-29', 2,
    45.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='311' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='42905551' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-28', '2026-04-29', 1,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='311' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='42905551' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-28', '2026-04-29', 1,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='402' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75873202' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-28', '2026-04-28', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='304' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75873202' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-28', '2026-04-29', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='411' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46968706' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-27', '2026-04-28', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='407' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75713301' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-27', '2026-04-28', 1,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='406' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72035048' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-27', '2026-04-28', 2,
    66.3, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='408' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='74076582' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-27', '2026-04-27', 2,
    63.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='410' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46968706' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-27', '2026-04-28', 1,
    270.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='305' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='8309398' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-27', '2026-04-30', 2,
    20.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='415' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='22410449' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-27', '2026-04-30', 2,
    16.67, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='412' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='20057710' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-26', '2026-04-27', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='304' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='74444320' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-26', '2026-04-27', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='405' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='20111864595' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-26', '2026-04-28', 2,
    30.0, '996549823'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='306' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='8309398' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-26', '2026-04-30', 2,
    10.0, '989329640'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='412' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73967955' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-26', '2026-04-26', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='409' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72186658' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-26', '2026-04-26', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='305' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='61258313' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-26', '2026-04-27', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='408' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73083182' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-26', '2026-04-26', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='405' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='76431998' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-26', '2026-04-26', 2,
    120.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='311' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='73540225' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-25', '2026-04-26', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='308' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='70995987' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-25', '2026-04-25', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='306' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75980053' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-25', '2026-04-26', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='402' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='48235102' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-25', '2026-04-26', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='304' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='61048754' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-25', '2026-04-26', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='413' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46933142' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-25', '2026-04-26', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='307' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='48699650' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-25', '2026-04-26', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='304' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75820185' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-25', '2026-04-25', 2,
    77.4, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='309' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72023153' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-25', '2026-04-26', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='402' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72274610' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-24', '2026-04-25', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='305' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46389545' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-24', '2026-04-25', 1,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='412' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46174022' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-24', '2026-04-25', 2,
    10.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='401' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='21442178' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-24', '2026-04-30', 2,
    6.67, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='409' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='47924697' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-24', '2026-04-25', 2,
    45.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='410' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='48065140' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-24', '2026-04-25', 2,
    55.4, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='415' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='492987' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-24', '2026-04-25', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='414' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='41658010' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-24', '2026-04-25', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='412' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='45821448' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-24', '2026-04-25', 2,
    77.4, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='304' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46948573' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-24', '2026-04-24', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='408' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='9789251' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-23', '2026-04-24', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='306' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='9987844' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-23', '2026-04-25', 2,
    30.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='407' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46174022' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-23', '2026-04-24', 2,
    105.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='406' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='71417733' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-23', '2026-04-24', 2,
    60.0, 'POR HORAS'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='306' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='9987844' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-23', '2026-04-24', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='309' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72023153' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-23', '2026-04-24', 2,
    315.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='410' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='48065140' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-23', '2026-04-24', 1,
    40.0, 'RENOVACIÓN'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='411' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='46822541' LIMIT 1),
    'WHATSAPP', 'CHECKOUT_REALIZADO',
    '2026-04-23', '2026-04-24', 2,
    50.0, 'RESERVA WHATSAPP'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='409' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='47924697' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-23', '2026-04-24', 1,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='405' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='74375004' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-23', '2026-04-24', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='402' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='61826551' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-23', '2026-04-24', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='306' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='74471189' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-22', '2026-04-23', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='311' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='15696062' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-22', '2026-04-23', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='407' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='45144088' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-22', '2026-04-23', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='410' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='48065140' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-22', '2026-04-23', 1,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='414' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='41658010' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-22', '2026-04-23', 2,
    60.0, 'RENOVACIÓN'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='412' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='45821448' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-22', '2026-04-23', 2,
    70.0, 'RENOVACIÓN'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='309' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='627543890N' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-22', '2026-04-23', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='305' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='514024' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-22', '2026-04-23', 2,
    60.0, 'RENOVACIÓN'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='402' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='29617882' LIMIT 1),
    'BOOKING_COM', 'CHECKOUT_REALIZADO',
    '2026-04-21', '2026-04-22', 2,
    0.0, 'RESERVA DE BOOKING'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='410' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72558462' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-21', '2026-04-22', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='306' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='70464764' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-21', '2026-04-22', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='309' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='47382163' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-21', '2026-04-22', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='407' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='45144088' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-21', '2026-04-22', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='311' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='15696062' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-21', '2026-04-22', 2,
    40.0, 'RENOVACION'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='412' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='45821448' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-21', '2026-04-22', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='414' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='41658010' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-21', '2026-04-22', 2,
    70.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='409' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72216534' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-21', '2026-04-23', 2,
    35.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='408' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='74076582' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-20', '2026-04-20', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='302' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='76000203' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-20', '2026-04-21', 2,
    90.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='306' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='22486705' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-20', '2026-04-21', 2,
    60.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='311' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='15696062' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-20', '2026-04-21', 2,
    40.0, 'RENOVACIÓN'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='413' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='10867033' LIMIT 1),
    'WHATSAPP', 'CHECKOUT_REALIZADO',
    '2026-04-20', '2026-04-25', 2,
    14.0, 'RESERVA WHATSAPP PAGO CON TARJETA ,SE LE COBRO EL 5%'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='410' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72558462' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-20', '2026-04-21', 2,
    50.0, 'RENOVACION'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='403' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='47025327' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-20', '2026-04-20', 2,
    90.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='410' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='72558462' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-20', '2026-04-20', 2,
    50.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='302' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='22486705' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-20', '2026-04-21', 2,
    90.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='311' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='15696062' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-20', '2026-04-20', 2,
    40.0, '-'
  ),
  (
    (SELECT id FROM habitaciones WHERE numero='314' LIMIT 1),
    (SELECT id FROM huespedes WHERE numero_documento='75575325' LIMIT 1),
    'DIRECTO', 'CHECKOUT_REALIZADO',
    '2026-04-20', '2026-04-21', 2,
    80.0, '-'
  )
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- SECCIÓN 5: PAGOS (uno por cada reserva del historial)
-- ─────────────────────────────────────────────────────────────────
-- Asociar pagos a las reservas por índice de inserción
WITH reservas_nuevas AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) - 1 AS rn
  FROM reservas
  WHERE created_at = NOW()  -- solo las insertadas en esta transacción
  ORDER BY created_at ASC LIMIT 300
),
pagos_data(rn, monto, metodo) AS (VALUES
  (0, 50.0, 'PLIN'),
  (1, 56.7, 'TARJETA_CREDITO'),
  (2, 265.2, 'PLIN'),
  (3, 140.0, 'PLIN'),
  (4, 199.0, 'EFECTIVO'),
  (5, 60.0, 'EFECTIVO'),
  (6, 80.0, 'YAPE'),
  (7, 250.5, 'TARJETA_CREDITO'),
  (8, 70.0, 'YAPE'),
  (9, 63.0, 'TARJETA_DEBITO'),
  (10, 70.0, 'YAPE'),
  (11, 50.0, 'YAPE'),
  (12, 60.0, 'YAPE'),
  (13, 60.0, 'YAPE'),
  (14, 110.5, 'YAPE'),
  (15, 270.0, 'YAPE'),
  (16, 70.0, 'YAPE'),
  (17, 50.0, 'YAPE'),
  (18, 70.0, 'YAPE'),
  (19, 70.0, 'YAPE'),
  (20, 60.0, 'YAPE'),
  (21, 40.0, 'YAPE'),
  (22, 74.0, 'TARJETA_CREDITO'),
  (23, 49.1, 'YAPE'),
  (24, 78.1, 'PLIN'),
  (25, 53.0, 'TARJETA_CREDITO'),
  (26, 70.0, 'YAPE'),
  (27, 50.0, 'PLIN'),
  (28, 74.0, 'TARJETA_CREDITO'),
  (29, 70.0, 'YAPE'),
  (30, 70.0, 'YAPE'),
  (31, 50.0, 'YAPE'),
  (32, 70.0, 'YAPE'),
  (33, 70.0, 'YAPE'),
  (34, 55.0, 'PLIN'),
  (35, 70.0, 'YAPE'),
  (36, 40.0, 'PLIN'),
  (37, 70.0, 'PLIN'),
  (38, 100.0, 'EFECTIVO'),
  (39, 98.2, 'EFECTIVO'),
  (40, 67.26, 'TARJETA_CREDITO'),
  (41, 100.0, 'YAPE'),
  (42, 120.0, 'YAPE'),
  (43, 55.0, 'PLIN'),
  (44, 90.0, 'YAPE'),
  (45, 70.0, 'YAPE'),
  (46, 50.0, 'YAPE'),
  (47, 100.0, 'EFECTIVO'),
  (48, 100.0, 'PLIN'),
  (49, 55.0, 'PLIN'),
  (50, 70.0, 'YAPE'),
  (51, 40.0, 'YAPE'),
  (52, 70.0, 'YAPE'),
  (53, 50.0, 'PLIN'),
  (54, 60.0, 'PLIN'),
  (55, 110.0, 'PLIN'),
  (56, 40.0, 'YAPE'),
  (57, 70.0, 'YAPE'),
  (58, 100.0, 'EFECTIVO'),
  (59, 110.0, 'YAPE'),
  (60, 60.0, 'YAPE'),
  (61, 60.0, 'YAPE'),
  (62, 63.0, 'TARJETA_CREDITO'),
  (63, 17.7, 'TRANSFERENCIA'),
  (64, 50.0, 'EFECTIVO'),
  (65, 45.0, 'YAPE'),
  (66, 200.0, 'EFECTIVO'),
  (67, 50.0, 'EFECTIVO'),
  (68, 60.0, 'EFECTIVO'),
  (69, 110.0, 'EFECTIVO'),
  (70, 55.0, 'YAPE'),
  (71, 85.2, 'YAPE'),
  (72, 60.0, 'EFECTIVO'),
  (73, 45.0, 'YAPE'),
  (74, 100.0, 'YAPE'),
  (75, 100.0, 'YAPE'),
  (76, 120.0, 'EFECTIVO'),
  (77, 40.0, 'YAPE'),
  (78, 50.0, 'EFECTIVO'),
  (79, 60.0, 'EFECTIVO'),
  (80, 110.0, 'EFECTIVO'),
  (81, 85.2, 'YAPE'),
  (82, 60.0, 'YAPE'),
  (83, 40.0, 'EFECTIVO'),
  (84, 40.0, 'YAPE'),
  (85, 40.0, 'YAPE'),
  (86, 31.9, 'TARJETA_CREDITO'),
  (87, 60.0, 'YAPE'),
  (88, 120.0, 'EFECTIVO'),
  (89, 60.0, 'YAPE'),
  (90, 60.0, 'YAPE'),
  (91, 40.0, 'EFECTIVO'),
  (92, 50.0, 'PLIN'),
  (93, 60.0, 'YAPE'),
  (94, 70.0, 'YAPE'),
  (95, 40.0, 'YAPE'),
  (96, 200.0, 'TARJETA_CREDITO'),
  (97, 40.0, 'YAPE'),
  (98, 70.0, 'YAPE'),
  (99, 50.0, 'EFECTIVO'),
  (100, 40.0, 'EFECTIVO'),
  (101, 50.0, 'PLIN'),
  (102, 50.0, 'YAPE'),
  (103, 70.0, 'EFECTIVO'),
  (104, 60.0, 'EFECTIVO'),
  (105, 35.0, 'YAPE'),
  (106, 35.0, 'EFECTIVO'),
  (107, 40.0, 'EFECTIVO'),
  (108, 81.0, 'EFECTIVO'),
  (109, 50.0, 'YAPE'),
  (110, 40.0, 'EFECTIVO'),
  (111, 70.0, 'EFECTIVO'),
  (112, 50.0, 'YAPE'),
  (113, 40.0, 'EFECTIVO'),
  (114, 70.0, 'PLIN'),
  (115, 50.0, 'YAPE'),
  (116, 50.0, 'YAPE'),
  (117, 50.0, 'PLIN'),
  (118, 40.0, 'EFECTIVO'),
  (119, 50.0, 'YAPE'),
  (120, 220.0, 'EFECTIVO'),
  (121, 60.0, 'YAPE'),
  (122, 63.0, 'TARJETA_CREDITO'),
  (123, 70.0, 'YAPE'),
  (124, 70.0, 'EFECTIVO'),
  (125, 50.0, 'YAPE'),
  (126, 55.0, 'YAPE'),
  (127, 65.0, 'YAPE'),
  (128, 60.0, 'YAPE'),
  (129, 100.0, 'YAPE'),
  (130, 60.0, 'YAPE'),
  (131, 50.0, 'EFECTIVO'),
  (132, 60.0, 'YAPE'),
  (133, 60.0, 'YAPE'),
  (134, 60.0, 'EFECTIVO'),
  (135, 50.0, 'EFECTIVO'),
  (136, 60.0, 'YAPE'),
  (137, 50.0, 'YAPE'),
  (138, 50.0, 'YAPE'),
  (139, 60.0, 'PLIN'),
  (140, 70.0, 'YAPE'),
  (141, 40.0, 'YAPE'),
  (142, 70.0, 'YAPE'),
  (143, 50.0, 'YAPE'),
  (144, 74.0, 'YAPE'),
  (145, 40.0, 'YAPE'),
  (146, 70.0, 'YAPE'),
  (147, 50.0, 'PLIN'),
  (148, 60.0, 'EFECTIVO'),
  (149, 70.0, 'YAPE'),
  (150, 40.0, 'EFECTIVO'),
  (151, 50.0, 'YAPE'),
  (152, 70.0, 'YAPE'),
  (153, 70.0, 'YAPE'),
  (154, 50.0, 'YAPE'),
  (155, 120.0, 'YAPE'),
  (156, 60.0, 'YAPE'),
  (157, 110.0, 'YAPE'),
  (158, 40.0, 'YAPE'),
  (159, 126.0, 'TARJETA_CREDITO'),
  (160, 126.0, 'TARJETA_CREDITO'),
  (161, 70.0, 'YAPE'),
  (162, 60.0, 'EFECTIVO'),
  (163, 70.0, 'YAPE'),
  (164, 70.0, 'EFECTIVO'),
  (165, 40.0, 'YAPE'),
  (166, 70.0, 'YAPE'),
  (167, 50.0, 'YAPE'),
  (168, 60.0, 'EFECTIVO'),
  (169, 220.0, 'EFECTIVO'),
  (170, 100.0, 'EFECTIVO'),
  (171, 50.0, 'EFECTIVO'),
  (172, 90.0, 'YAPE'),
  (173, 50.0, 'EFECTIVO'),
  (174, 40.0, 'EFECTIVO'),
  (175, 140.0, 'YAPE'),
  (176, 70.0, 'EFECTIVO'),
  (177, 50.0, 'YAPE'),
  (178, 130.0, 'EFECTIVO'),
  (179, 70.0, 'YAPE'),
  (180, 100.0, 'PLIN'),
  (181, 60.0, 'YAPE'),
  (182, 73.5, 'TARJETA_CREDITO'),
  (183, 70.0, 'YAPE'),
  (184, 100.0, 'YAPE'),
  (185, 70.0, 'YAPE'),
  (186, 40.0, 'EFECTIVO'),
  (187, 50.0, 'YAPE'),
  (188, 50.0, 'YAPE'),
  (189, 60.0, 'YAPE'),
  (190, 60.0, 'YAPE'),
  (191, 60.0, 'YAPE'),
  (192, 50.0, 'YAPE'),
  (193, 50.0, 'EFECTIVO'),
  (194, 50.0, 'YAPE'),
  (195, 50.0, 'EFECTIVO'),
  (196, 50.0, 'YAPE'),
  (197, 40.0, 'YAPE'),
  (198, 60.0, 'EFECTIVO'),
  (199, 100.0, 'EFECTIVO'),
  (200, 90.0, 'YAPE'),
  (201, 50.0, 'EFECTIVO'),
  (202, 40.0, 'EFECTIVO'),
  (203, 70.0, 'YAPE'),
  (204, 66.3, 'PLIN'),
  (205, 66.3, 'PLIN'),
  (206, 50.0, 'YAPE'),
  (207, 50.0, 'YAPE'),
  (208, 150.0, 'EFECTIVO'),
  (209, 60.0, 'EFECTIVO'),
  (210, 40.0, 'YAPE'),
  (211, 132.6, 'YAPE'),
  (212, 200.0, 'EFECTIVO'),
  (213, 50.0, 'YAPE'),
  (214, 50.0, 'YAPE'),
  (215, 60.0, 'EFECTIVO'),
  (216, 70.0, 'YAPE'),
  (217, 60.0, 'PLIN'),
  (218, 40.0, 'PLIN'),
  (219, 40.0, 'PLIN'),
  (220, 70.0, 'EFECTIVO'),
  (221, 45.0, 'YAPE'),
  (222, 50.0, 'YAPE'),
  (223, 70.0, 'PLIN'),
  (224, 40.0, 'EFECTIVO'),
  (225, 40.0, 'YAPE'),
  (226, 40.0, 'YAPE'),
  (227, 60.0, 'YAPE'),
  (228, 66.3, 'EFECTIVO'),
  (229, 63.0, 'TARJETA_CREDITO'),
  (230, 270.0, 'EFECTIVO'),
  (231, 60.0, 'PLIN'),
  (232, 50.0, 'YAPE'),
  (233, 70.0, 'EFECTIVO'),
  (234, 60.0, 'YAPE'),
  (235, 60.0, 'YAPE'),
  (236, 40.0, 'YAPE'),
  (237, 60.0, 'EFECTIVO'),
  (238, 60.0, 'YAPE'),
  (239, 50.0, 'YAPE'),
  (240, 60.0, 'PLIN'),
  (241, 120.0, 'EFECTIVO'),
  (242, 40.0, 'YAPE'),
  (243, 50.0, 'PLIN'),
  (244, 70.0, 'YAPE'),
  (245, 60.0, 'YAPE'),
  (246, 70.0, 'YAPE'),
  (247, 70.0, 'PLIN'),
  (248, 40.0, 'EFECTIVO'),
  (249, 77.4, 'YAPE'),
  (250, 50.0, 'PLIN'),
  (251, 60.0, 'TRANSFERENCIA'),
  (252, 50.0, 'PLIN'),
  (253, 10.0, 'EFECTIVO'),
  (254, 40.0, 'EFECTIVO'),
  (255, 45.0, 'PLIN'),
  (256, 55.4, 'EFECTIVO'),
  (257, 70.0, 'YAPE'),
  (258, 50.0, 'EFECTIVO'),
  (259, 77.4, 'YAPE'),
  (260, 40.0, 'YAPE'),
  (261, 60.0, 'EFECTIVO'),
  (262, 60.0, 'EFECTIVO'),
  (263, 105.0, 'TARJETA_CREDITO'),
  (264, 60.0, 'PLIN'),
  (265, 50.0, 'YAPE'),
  (266, 315.0, 'TARJETA_CREDITO'),
  (267, 40.0, 'YAPE'),
  (268, 50.0, 'EFECTIVO'),
  (269, 70.0, 'YAPE'),
  (270, 60.0, 'YAPE'),
  (271, 60.0, 'PLIN'),
  (272, 60.0, 'YAPE'),
  (273, 40.0, 'TRANSFERENCIA'),
  (274, 60.0, 'EFECTIVO'),
  (275, 50.0, 'PLIN'),
  (276, 60.0, 'YAPE'),
  (277, 70.0, 'EFECTIVO'),
  (278, 40.0, 'YAPE'),
  (279, 60.0, 'EFECTIVO'),
  (280, 0, 'TARJETA_CREDITO'),
  (281, 50.0, 'YAPE'),
  (282, 70.0, 'YAPE'),
  (283, 40.0, 'EFECTIVO'),
  (284, 70.0, 'TARJETA_CREDITO'),
  (285, 40.0, 'PLIN'),
  (286, 70.0, 'TARJETA_CREDITO'),
  (287, 70.0, 'YAPE'),
  (288, 70.0, 'EFECTIVO'),
  (289, 60.0, 'YAPE'),
  (290, 90.0, 'YAPE'),
  (291, 60.0, 'YAPE'),
  (292, 40.0, 'EFECTIVO'),
  (293, 70.0, 'YAPE'),
  (294, 50.0, 'YAPE'),
  (295, 90.0, 'YAPE'),
  (296, 50.0, 'YAPE'),
  (297, 90.0, 'YAPE'),
  (298, 40.0, 'YAPE'),
  (299, 80.0, 'YAPE')
)
INSERT INTO pagos (reserva_id, metodo, monto, estado)
SELECT rn2.id, pd.metodo::"MetodoPago", pd.monto, 'COMPLETADO'::"EstadoPago"
FROM reservas_nuevas rn2
JOIN pagos_data pd ON rn2.rn = pd.rn
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- VERIFICACIÓN FINAL
-- ─────────────────────────────────────────────────────────────────
SELECT 'tipos_habitacion' AS tabla, COUNT(*) AS total FROM tipos_habitacion
UNION ALL SELECT 'habitaciones', COUNT(*) FROM habitaciones
UNION ALL SELECT 'huespedes',    COUNT(*) FROM huespedes
UNION ALL SELECT 'reservas',     COUNT(*) FROM reservas
UNION ALL SELECT 'pagos',        COUNT(*) FROM pagos;

COMMIT;

-- FIN DEL SEED