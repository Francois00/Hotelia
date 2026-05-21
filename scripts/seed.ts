/**
 * Seed script — realistic hotel data for development and staging.
 * Run with: npx ts-node scripts/seed.ts
 * (from the project root, DATABASE_URL must be set)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Hotel PMS database...\n");

  // ─── 1. Personal ───────────────────────────────────────────────────────────
  console.log("1/6 — Creating staff...");

  const passwordHash = await bcrypt.hash("Hotel2024!", 12);

  const [admin, gerente, recep1, recep2, housekeeping] = await Promise.all([
    prisma.personal.upsert({
      where: { email: "admin@hotel.com" },
      update: { password_hash: passwordHash, rol: "ADMIN", activo: true },
      create: {
        nombre: "Carlos",
        apellido: "Mendoza",
        email: "admin@hotel.com",
        password_hash: passwordHash,
        rol: "ADMIN",
      },
    }),
    prisma.personal.upsert({
      where: { email: "gerente@hotel.com" },
      update: { password_hash: passwordHash, rol: "GERENTE", activo: true },
      create: {
        nombre: "Lucía",
        apellido: "Torres",
        email: "gerente@hotel.com",
        password_hash: passwordHash,
        rol: "GERENTE",
      },
    }),
    prisma.personal.upsert({
      where: { email: "recepcion1@hotel.com" },
      update: { password_hash: passwordHash, rol: "RECEPCIONISTA", activo: true },
      create: {
        nombre: "Miguel",
        apellido: "Quispe",
        email: "recepcion1@hotel.com",
        password_hash: passwordHash,
        rol: "RECEPCIONISTA",
      },
    }),
    prisma.personal.upsert({
      where: { email: "recepcion2@hotel.com" },
      update: { password_hash: passwordHash, rol: "RECEPCIONISTA", activo: true },
      create: {
        nombre: "Ana",
        apellido: "Paredes",
        email: "recepcion2@hotel.com",
        password_hash: passwordHash,
        rol: "RECEPCIONISTA",
      },
    }),
    prisma.personal.upsert({
      where: { email: "housekeeping@hotel.com" },
      update: { password_hash: passwordHash, rol: "HOUSEKEEPING", activo: true },
      create: {
        nombre: "Rosa",
        apellido: "Huanca",
        email: "housekeeping@hotel.com",
        password_hash: passwordHash,
        rol: "HOUSEKEEPING",
      },
    }),
  ]);

  console.log(`   ✓ 5 staff created (admin: ${admin.email})`);

  // ─── 2. Habitaciones (36 rooms) ────────────────────────────────────────────
  console.log("2/6 — Creating rooms...");

  type RoomDef = {
    numero: string;
    tipo: "SIMPLE" | "DOBLE" | "SUITE" | "FAMILIAR";
    piso: number;
    capacidad: number;
    tarifa_base: number;
    estado: "DISPONIBLE" | "OCUPADA" | "RESERVADA" | "MANTENIMIENTO" | "LIMPIEZA" | "FUERA_DE_SERVICIO";
    amenidades: Record<string, unknown>;
  };

  const roomDefs: RoomDef[] = [
    // Piso 1 — Simples
    { numero: "101", tipo: "SIMPLE", piso: 1, capacidad: 1, tarifa_base: 120, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: false } },
    { numero: "102", tipo: "SIMPLE", piso: 1, capacidad: 1, tarifa_base: 120, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: false } },
    { numero: "103", tipo: "SIMPLE", piso: 1, capacidad: 1, tarifa_base: 125, estado: "LIMPIEZA",   amenidades: { wifi: true, tv: true, ac: false } },
    { numero: "104", tipo: "SIMPLE", piso: 1, capacidad: 1, tarifa_base: 125, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: false } },
    { numero: "105", tipo: "SIMPLE", piso: 1, capacidad: 1, tarifa_base: 120, estado: "MANTENIMIENTO", amenidades: { wifi: true, tv: false, ac: false } },
    { numero: "106", tipo: "SIMPLE", piso: 1, capacidad: 1, tarifa_base: 120, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: false } },
    // Piso 1 — Dobles
    { numero: "107", tipo: "DOBLE", piso: 1, capacidad: 2, tarifa_base: 200, estado: "OCUPADA",    amenidades: { wifi: true, tv: true, ac: true, minibar: false } },
    { numero: "108", tipo: "DOBLE", piso: 1, capacidad: 2, tarifa_base: 200, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: true, minibar: false } },
    { numero: "109", tipo: "DOBLE", piso: 1, capacidad: 2, tarifa_base: 210, estado: "RESERVADA",  amenidades: { wifi: true, tv: true, ac: true, minibar: true } },
    { numero: "110", tipo: "DOBLE", piso: 1, capacidad: 2, tarifa_base: 200, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: true, minibar: false } },
    // Piso 2 — Simples
    { numero: "201", tipo: "SIMPLE", piso: 2, capacidad: 1, tarifa_base: 130, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: true } },
    { numero: "202", tipo: "SIMPLE", piso: 2, capacidad: 1, tarifa_base: 130, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: true } },
    { numero: "203", tipo: "SIMPLE", piso: 2, capacidad: 1, tarifa_base: 130, estado: "OCUPADA",    amenidades: { wifi: true, tv: true, ac: true } },
    { numero: "204", tipo: "SIMPLE", piso: 2, capacidad: 1, tarifa_base: 130, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: true } },
    // Piso 2 — Dobles
    { numero: "205", tipo: "DOBLE", piso: 2, capacidad: 2, tarifa_base: 220, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: true, minibar: true } },
    { numero: "206", tipo: "DOBLE", piso: 2, capacidad: 2, tarifa_base: 220, estado: "OCUPADA",    amenidades: { wifi: true, tv: true, ac: true, minibar: true } },
    { numero: "207", tipo: "DOBLE", piso: 2, capacidad: 2, tarifa_base: 215, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: true, minibar: false } },
    { numero: "208", tipo: "DOBLE", piso: 2, capacidad: 2, tarifa_base: 220, estado: "RESERVADA",  amenidades: { wifi: true, tv: true, ac: true, minibar: true } },
    // Piso 2 — Familiares
    { numero: "209", tipo: "FAMILIAR", piso: 2, capacidad: 4, tarifa_base: 350, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: true, minibar: true, sofa_cama: true } },
    { numero: "210", tipo: "FAMILIAR", piso: 2, capacidad: 4, tarifa_base: 350, estado: "OCUPADA",    amenidades: { wifi: true, tv: true, ac: true, minibar: true, sofa_cama: true } },
    // Piso 3 — Dobles premium
    { numero: "301", tipo: "DOBLE", piso: 3, capacidad: 2, tarifa_base: 250, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: true, minibar: true, balcon: true } },
    { numero: "302", tipo: "DOBLE", piso: 3, capacidad: 2, tarifa_base: 250, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: true, minibar: true, balcon: true } },
    { numero: "303", tipo: "DOBLE", piso: 3, capacidad: 2, tarifa_base: 255, estado: "OCUPADA",    amenidades: { wifi: true, tv: true, ac: true, minibar: true, balcon: true } },
    { numero: "304", tipo: "DOBLE", piso: 3, capacidad: 2, tarifa_base: 250, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: true, minibar: true, balcon: true } },
    // Piso 3 — Familiares
    { numero: "305", tipo: "FAMILIAR", piso: 3, capacidad: 4, tarifa_base: 380, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: true, minibar: true, sofa_cama: true, balcon: true } },
    { numero: "306", tipo: "FAMILIAR", piso: 3, capacidad: 4, tarifa_base: 380, estado: "RESERVADA",  amenidades: { wifi: true, tv: true, ac: true, minibar: true, sofa_cama: true, balcon: true } },
    // Piso 4 — Suites
    { numero: "401", tipo: "SUITE", piso: 4, capacidad: 2, tarifa_base: 550, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: true, minibar: true, jacuzzi: true, sala: true } },
    { numero: "402", tipo: "SUITE", piso: 4, capacidad: 2, tarifa_base: 550, estado: "OCUPADA",    amenidades: { wifi: true, tv: true, ac: true, minibar: true, jacuzzi: true, sala: true } },
    { numero: "403", tipo: "SUITE", piso: 4, capacidad: 3, tarifa_base: 620, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: true, minibar: true, jacuzzi: true, sala: true, terraza: true } },
    { numero: "404", tipo: "SUITE", piso: 4, capacidad: 2, tarifa_base: 550, estado: "RESERVADA",  amenidades: { wifi: true, tv: true, ac: true, minibar: true, jacuzzi: true, sala: true } },
    // Piso 4 — Suite presidencial
    { numero: "405", tipo: "SUITE", piso: 4, capacidad: 4, tarifa_base: 950, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: true, minibar: true, jacuzzi: true, sala: true, terraza: true, cocina: true, comedor: true } },
    // Piso 5 — Más dobles
    { numero: "501", tipo: "DOBLE", piso: 5, capacidad: 2, tarifa_base: 280, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: true, minibar: true, vista_mar: true } },
    { numero: "502", tipo: "DOBLE", piso: 5, capacidad: 2, tarifa_base: 280, estado: "DISPONIBLE", amenidades: { wifi: true, tv: true, ac: true, minibar: true, vista_mar: true } },
    { numero: "503", tipo: "DOBLE", piso: 5, capacidad: 2, tarifa_base: 280, estado: "OCUPADA",    amenidades: { wifi: true, tv: true, ac: true, minibar: true, vista_mar: true } },
    { numero: "504", tipo: "DOBLE", piso: 5, capacidad: 2, tarifa_base: 280, estado: "LIMPIEZA",   amenidades: { wifi: true, tv: true, ac: true, minibar: true, vista_mar: true } },
  ];

  const habitaciones = await Promise.all(
    roomDefs.map((r) =>
      prisma.habitacion.upsert({
        where: { numero: r.numero },
        update: {},
        create: {
          numero: r.numero,
          tipo: r.tipo,
          piso: r.piso,
          capacidad: r.capacidad,
          tarifa_base: r.tarifa_base,
          estado: r.estado,
          amenidades: r.amenidades,
        },
      })
    )
  );

  console.log(`   ✓ ${habitaciones.length} rooms created`);

  // ─── 3. Huéspedes (15 guests) ──────────────────────────────────────────────
  console.log("3/6 — Creating guests...");

  type HuespedDef = {
    nombre: string;
    apellido: string;
    email: string;
    telefono: string;
    tipo_documento: "DNI" | "PASAPORTE" | "CE";
    numero_documento: string;
    nacionalidad: string;
    segmento: "NUEVO" | "NORMAL" | "RECURRENTE" | "OCASIONAL" | "VIP" | "CORPORATIVO" | "INACTIVO";
    idioma_preferido: "ES" | "EN" | "PT" | "FR" | "DE";
    ltv: number;
    preferencias: Record<string, unknown>;
  };

  const huespedDefs: HuespedDef[] = [
    { nombre: "Elena",    apellido: "Gutiérrez",  email: "elena.g@email.com",      telefono: "+51987001001", tipo_documento: "DNI",       numero_documento: "45678901", nacionalidad: "Peruana",    segmento: "VIP",         idioma_preferido: "ES", ltv: 12400, preferencias: { habitacion_preferida: "SUITE", almohada: "blanda", piso_alto: true } },
    { nombre: "James",    apellido: "Walker",      email: "j.walker@corp.io",        telefono: "+1555001001",  tipo_documento: "PASAPORTE", numero_documento: "P1234567A", nacionalidad: "Americana",  segmento: "CORPORATIVO", idioma_preferido: "EN", ltv: 8750,  preferencias: { desayuno: true, piso_alto: true, gym: true } },
    { nombre: "Sofía",    apellido: "Ramírez",     email: "sofia.r@gmail.com",       telefono: "+51987001002", tipo_documento: "DNI",       numero_documento: "52345678", nacionalidad: "Peruana",    segmento: "RECURRENTE",  idioma_preferido: "ES", ltv: 5200,  preferencias: { no_fumar: true, vista: "jardín" } },
    { nombre: "Hans",     apellido: "Müller",      email: "h.muller@gmx.de",         telefono: "+4915001001",  tipo_documento: "PASAPORTE", numero_documento: "P9876543B", nacionalidad: "Alemana",    segmento: "VIP",         idioma_preferido: "DE", ltv: 15800, preferencias: { habitacion_preferida: "SUITE", cerveza_artesanal: true } },
    { nombre: "María",    apellido: "Fernández",   email: "maria.f@hotmail.com",     telefono: "+51987001003", tipo_documento: "DNI",       numero_documento: "63456789", nacionalidad: "Peruana",    segmento: "NORMAL",      idioma_preferido: "ES", ltv: 1800,  preferencias: { no_fumar: true } },
    { nombre: "Lucas",    apellido: "Silva",       email: "l.silva@uol.com.br",      telefono: "+5511001001",  tipo_documento: "PASAPORTE", numero_documento: "BR123456",  nacionalidad: "Brasileña",  segmento: "NUEVO",       idioma_preferido: "PT", ltv: 650,   preferencias: { desayuno: true } },
    { nombre: "Camille",  apellido: "Dupont",      email: "c.dupont@laposte.fr",     telefono: "+3306001001",  tipo_documento: "PASAPORTE", numero_documento: "FR654321",  nacionalidad: "Francesa",   segmento: "OCASIONAL",   idioma_preferido: "FR", ltv: 2100,  preferencias: { vista: "mar" } },
    { nombre: "Roberto",  apellido: "Chávez",      email: "r.chavez@empresa.pe",     telefono: "+51987001004", tipo_documento: "DNI",       numero_documento: "74567890", nacionalidad: "Peruana",    segmento: "CORPORATIVO", idioma_preferido: "ES", ltv: 6300,  preferencias: { desayuno: true, estacionamiento: true } },
    { nombre: "Yuki",     apellido: "Tanaka",      email: "y.tanaka@jp.email",       telefono: "+8190001001",  tipo_documento: "PASAPORTE", numero_documento: "JP234567",  nacionalidad: "Japonesa",   segmento: "RECURRENTE",  idioma_preferido: "EN", ltv: 4800,  preferencias: { piso_alto: true, silencio: true } },
    { nombre: "Patricia", apellido: "Morales",     email: "p.morales@icloud.com",    telefono: "+51987001005", tipo_documento: "DNI",       numero_documento: "85678901", nacionalidad: "Peruana",    segmento: "VIP",         idioma_preferido: "ES", ltv: 18200, preferencias: { habitacion_preferida: "SUITE", spa: true, flores: true } },
    { nombre: "Tom",      apellido: "Bennett",     email: "tom.b@outlook.co.uk",     telefono: "+4479001001",  tipo_documento: "PASAPORTE", numero_documento: "UK345678",  nacionalidad: "Británica",  segmento: "NORMAL",      idioma_preferido: "EN", ltv: 2400,  preferencias: { no_fumar: true } },
    { nombre: "Diego",    apellido: "Rojas",       email: "d.rojas@gmail.com",       telefono: "+51987001006", tipo_documento: "DNI",       numero_documento: "96789012", nacionalidad: "Peruana",    segmento: "NUEVO",       idioma_preferido: "ES", ltv: 320,   preferencias: {} },
    { nombre: "Valentina",apellido: "Castillo",    email: "v.castillo@gmail.com",    telefono: "+56912001001", tipo_documento: "PASAPORTE", numero_documento: "CL456789",  nacionalidad: "Chilena",    segmento: "OCASIONAL",   idioma_preferido: "ES", ltv: 1550,  preferencias: { vista: "ciudad" } },
    { nombre: "Ahmed",    apellido: "Al-Rashid",   email: "ahmed.r@arabmail.ae",     telefono: "+9715001001",  tipo_documento: "PASAPORTE", numero_documento: "AE567890",  nacionalidad: "Emiratí",    segmento: "VIP",         idioma_preferido: "EN", ltv: 24600, preferencias: { habitacion_preferida: "SUITE", privacidad: true } },
    { nombre: "Carmen",   apellido: "Vega",        email: "c.vega@empresa.pe",       telefono: "+51987001007", tipo_documento: "DNI",       numero_documento: "07890123", nacionalidad: "Peruana",    segmento: "INACTIVO",    idioma_preferido: "ES", ltv: 900,   preferencias: {} },
  ];

  const huespedes = await Promise.all(
    huespedDefs.map((h) =>
      prisma.huesped.upsert({
        where: { numero_documento: h.numero_documento },
        update: {},
        create: {
          nombre: h.nombre,
          apellido: h.apellido,
          email: h.email,
          telefono: h.telefono,
          tipo_documento: h.tipo_documento,
          numero_documento: h.numero_documento,
          nacionalidad: h.nacionalidad,
          segmento: h.segmento,
          idioma_preferido: h.idioma_preferido,
          ltv: h.ltv,
          preferencias: h.preferencias,
        },
      })
    )
  );

  console.log(`   ✓ ${huespedes.length} guests created`);

  // ─── 4. Reservas (20) ─────────────────────────────────────────────────────
  console.log("4/6 — Creating reservations...");

  type ReservaDef = {
    codigo: string;
    huesped_idx: number;
    habitacion_numero: string;
    fecha_entrada: string;
    fecha_salida: string;
    estado: "CONFIRMADA" | "CHECKIN_REALIZADO" | "CHECKOUT_REALIZADO" | "CANCELADA" | "NO_SHOW";
    canal: "DIRECTO" | "BOOKING_COM" | "EXPEDIA" | "WHATSAPP" | "TELEFONO" | "AIRBNB";
    tarifa_acordada: number;
    adultos: number;
    ninos: number;
    personal_idx: number;
    notas?: string;
  };

  const reservaDefs: ReservaDef[] = [
    { codigo: "RES-2024-0001", huesped_idx: 0,  habitacion_numero: "401", fecha_entrada: "2024-11-01", fecha_salida: "2024-11-05", estado: "CHECKOUT_REALIZADO", canal: "DIRECTO",     tarifa_acordada: 550,  adultos: 2, ninos: 0, personal_idx: 2 },
    { codigo: "RES-2024-0002", huesped_idx: 1,  habitacion_numero: "301", fecha_entrada: "2024-11-10", fecha_salida: "2024-11-12", estado: "CHECKOUT_REALIZADO", canal: "BOOKING_COM", tarifa_acordada: 280,  adultos: 1, ninos: 0, personal_idx: 2 },
    { codigo: "RES-2024-0003", huesped_idx: 2,  habitacion_numero: "205", fecha_entrada: "2024-11-15", fecha_salida: "2024-11-18", estado: "CHECKOUT_REALIZADO", canal: "DIRECTO",     tarifa_acordada: 220,  adultos: 2, ninos: 0, personal_idx: 3 },
    { codigo: "RES-2024-0004", huesped_idx: 3,  habitacion_numero: "403", fecha_entrada: "2024-12-01", fecha_salida: "2024-12-07", estado: "CHECKOUT_REALIZADO", canal: "DIRECTO",     tarifa_acordada: 620,  adultos: 2, ninos: 0, personal_idx: 2, notas: "VIP — champagne al llegar" },
    { codigo: "RES-2024-0005", huesped_idx: 9,  habitacion_numero: "405", fecha_entrada: "2024-12-20", fecha_salida: "2024-12-27", estado: "CHECKOUT_REALIZADO", canal: "DIRECTO",     tarifa_acordada: 950,  adultos: 2, ninos: 2, personal_idx: 2, notas: "Suite presidencial — VIP máximo" },
    { codigo: "RES-2025-0001", huesped_idx: 4,  habitacion_numero: "107", fecha_entrada: "2025-01-05", fecha_salida: "2025-01-07", estado: "CHECKOUT_REALIZADO", canal: "WHATSAPP",    tarifa_acordada: 200,  adultos: 2, ninos: 0, personal_idx: 3 },
    { codigo: "RES-2025-0002", huesped_idx: 7,  habitacion_numero: "302", fecha_entrada: "2025-01-15", fecha_salida: "2025-01-17", estado: "CHECKOUT_REALIZADO", canal: "EXPEDIA",     tarifa_acordada: 265,  adultos: 1, ninos: 0, personal_idx: 2 },
    { codigo: "RES-2025-0003", huesped_idx: 8,  habitacion_numero: "201", fecha_entrada: "2025-02-10", fecha_salida: "2025-02-14", estado: "CHECKOUT_REALIZADO", canal: "BOOKING_COM", tarifa_acordada: 145,  adultos: 1, ninos: 0, personal_idx: 3 },
    { codigo: "RES-2025-0004", huesped_idx: 5,  habitacion_numero: "209", fecha_entrada: "2025-03-01", fecha_salida: "2025-03-05", estado: "CHECKOUT_REALIZADO", canal: "AIRBNB",      tarifa_acordada: 380,  adultos: 2, ninos: 2, personal_idx: 2 },
    { codigo: "RES-2025-0005", huesped_idx: 6,  habitacion_numero: "501", fecha_entrada: "2025-03-20", fecha_salida: "2025-03-23", estado: "CHECKOUT_REALIZADO", canal: "BOOKING_COM", tarifa_acordada: 295,  adultos: 2, ninos: 0, personal_idx: 3 },
    { codigo: "RES-2025-0006", huesped_idx: 13, habitacion_numero: "402", fecha_entrada: "2025-04-01", fecha_salida: "2025-04-06", estado: "CHECKOUT_REALIZADO", canal: "DIRECTO",     tarifa_acordada: 580,  adultos: 2, ninos: 0, personal_idx: 2, notas: "VIP — máxima privacidad requerida" },
    { codigo: "RES-2025-0007", huesped_idx: 0,  habitacion_numero: "403", fecha_entrada: "2025-04-15", fecha_salida: "2025-04-19", estado: "CHECKOUT_REALIZADO", canal: "DIRECTO",     tarifa_acordada: 640,  adultos: 2, ninos: 0, personal_idx: 2 },
    { codigo: "RES-2025-0008", huesped_idx: 2,  habitacion_numero: "306", fecha_entrada: "2025-05-01", fecha_salida: "2025-05-05", estado: "CHECKOUT_REALIZADO", canal: "TELEFONO",    tarifa_acordada: 395,  adultos: 2, ninos: 1, personal_idx: 3 },
    // Reservas activas (check-in realizado — matching the room estados OCUPADA)
    { codigo: "RES-2025-0009", huesped_idx: 1,  habitacion_numero: "107", fecha_entrada: "2025-05-11", fecha_salida: "2025-05-14", estado: "CHECKIN_REALIZADO", canal: "BOOKING_COM", tarifa_acordada: 215,  adultos: 1, ninos: 0, personal_idx: 2 },
    { codigo: "RES-2025-0010", huesped_idx: 3,  habitacion_numero: "402", fecha_entrada: "2025-05-10", fecha_salida: "2025-05-16", estado: "CHECKIN_REALIZADO", canal: "DIRECTO",     tarifa_acordada: 570,  adultos: 2, ninos: 0, personal_idx: 2, notas: "VIP — acceso spa complimentario" },
    { codigo: "RES-2025-0011", huesped_idx: 9,  habitacion_numero: "206", fecha_entrada: "2025-05-12", fecha_salida: "2025-05-15", estado: "CHECKIN_REALIZADO", canal: "DIRECTO",     tarifa_acordada: 230,  adultos: 2, ninos: 0, personal_idx: 3 },
    { codigo: "RES-2025-0012", huesped_idx: 7,  habitacion_numero: "210", fecha_entrada: "2025-05-09", fecha_salida: "2025-05-13", estado: "CHECKIN_REALIZADO", canal: "EXPEDIA",     tarifa_acordada: 365,  adultos: 2, ninos: 2, personal_idx: 2 },
    // Reservas futuras (CONFIRMADA)
    { codigo: "RES-2025-0013", huesped_idx: 4,  habitacion_numero: "109", fecha_entrada: "2025-05-20", fecha_salida: "2025-05-22", estado: "CONFIRMADA", canal: "WHATSAPP",    tarifa_acordada: 215,  adultos: 2, ninos: 0, personal_idx: 3 },
    { codigo: "RES-2025-0014", huesped_idx: 10, habitacion_numero: "208", fecha_entrada: "2025-05-25", fecha_salida: "2025-05-28", estado: "CONFIRMADA", canal: "BOOKING_COM", tarifa_acordada: 230,  adultos: 2, ninos: 0, personal_idx: 2 },
    { codigo: "RES-2025-0015", huesped_idx: 11, habitacion_numero: "203", fecha_entrada: "2025-06-01", fecha_salida: "2025-06-03", estado: "CONFIRMADA", canal: "DIRECTO",     tarifa_acordada: 130,  adultos: 1, ninos: 0, personal_idx: 3 },
  ];

  const habitacionMap = new Map(habitaciones.map((h) => [h.numero, h] as const));

  const reservas: Awaited<ReturnType<typeof prisma.reserva.upsert>>[] = [];
  for (const r of reservaDefs) {
    const hab = habitacionMap.get(r.habitacion_numero);
    if (!hab) {
      console.warn(`   WARN: habitacion ${r.habitacion_numero} not found, skipping ${r.codigo}`);
      continue;
    }
    const reserva = await prisma.reserva.upsert({
      where: { codigo: r.codigo },
      update: {},
      create: {
        codigo: r.codigo,
        huesped_id: huespedes[r.huesped_idx].id,
        habitacion_id: hab.id,
        fecha_entrada: new Date(r.fecha_entrada),
        fecha_salida: new Date(r.fecha_salida),
        estado: r.estado,
        canal: r.canal,
        tarifa_acordada: r.tarifa_acordada,
        adultos: r.adultos,
        ninos: r.ninos,
        personal_id: [admin, gerente, recep1, recep2, housekeeping][r.personal_idx]?.id,
        notas: r.notas,
      },
    });
    reservas.push(reserva);
  }

  console.log(`   ✓ ${reservas.length} reservations created`);

  // ─── 5. Folio items ────────────────────────────────────────────────────────
  console.log("5/6 — Creating folio items and payments...");

  // Add folio items for completed reservations
  const completedReservas = reservas.filter(
    (r) => reservaDefs.find((d) => d.codigo === r.codigo)?.estado === "CHECKOUT_REALIZADO"
  );

  for (const reserva of completedReservas) {
    const def = reservaDefs.find((d) => d.codigo === reserva.codigo)!;
    const noches = Math.round(
      (new Date(def.fecha_salida).getTime() - new Date(def.fecha_entrada).getTime()) /
        (1000 * 60 * 60 * 24)
    );
    const fechaEntrada = new Date(def.fecha_entrada);

    // Night charges
    for (let i = 0; i < noches; i++) {
      const fecha = new Date(fechaEntrada);
      fecha.setDate(fecha.getDate() + i);
      await prisma.folioItem.create({
        data: {
          reserva_id: reserva.id,
          descripcion: `Noche ${i + 1} — Habitación ${def.habitacion_numero}`,
          tipo: "HABITACION",
          cantidad: 1,
          precio_unitario: def.tarifa_acordada,
          fecha,
          personal_id: [admin, gerente, recep1, recep2, housekeeping][def.personal_idx]?.id,
        },
      });
    }

    // Extras for VIP guests
    if (def.notas?.includes("VIP") || def.huesped_idx === 13 || def.huesped_idx === 3) {
      await prisma.folioItem.createMany({
        data: [
          { reserva_id: reserva.id, descripcion: "Servicio de spa", tipo: "SPA", cantidad: 2, precio_unitario: 180, fecha: new Date(def.fecha_entrada), personal_id: recep1.id },
          { reserva_id: reserva.id, descripcion: "Minibar consumo", tipo: "MINIBAR", cantidad: 1, precio_unitario: 95, fecha: new Date(def.fecha_entrada), personal_id: recep1.id },
        ],
      });
    } else if (Math.random() > 0.5) {
      await prisma.folioItem.create({
        data: {
          reserva_id: reserva.id,
          descripcion: "Desayuno buffet",
          tipo: "RESTAURANTE",
          cantidad: def.adultos + def.ninos,
          precio_unitario: 45,
          fecha: new Date(def.fecha_entrada),
          personal_id: recep2.id,
        },
      });
    }

    // Payment for completed reservations
    const monto =
      def.tarifa_acordada * noches +
      (def.notas?.includes("VIP") || def.huesped_idx === 13 ? 455 : 0);

    await prisma.pago.create({
      data: {
        reserva_id: reserva.id,
        monto,
        moneda: "PEN",
        metodo: def.canal === "BOOKING_COM" || def.canal === "EXPEDIA" ? "TARJETA_CREDITO" : "TARJETA",
        estado: "COMPLETADO",
        numero_comprobante: `B001-${String(reservas.indexOf(reserva) + 1).padStart(6, "0")}`,
        tipo_comprobante: def.huesped_idx === 1 || def.huesped_idx === 7 ? "FACTURA" : "BOLETA",
        personal_id: [admin, gerente, recep1, recep2, housekeeping][def.personal_idx]?.id,
      },
    });
  }

  console.log(`   ✓ Folio items and payments created for ${completedReservas.length} reservations`);

  // ─── 6. Reviews (10) ───────────────────────────────────────────────────────
  console.log("6/6 — Creating reviews...");

  const reviewData: Array<{
    reserva_idx: number;
    canal: "DIRECTO" | "BOOKING_COM" | "EXPEDIA" | "GOOGLE" | "TRIPADVISOR";
    puntuacion: number;
    texto: string;
    sentimiento: "POSITIVO" | "NEUTRAL" | "NEGATIVO";
    respondido: boolean;
    respuesta?: string;
  }> = [
    {
      reserva_idx: 0,
      canal: "DIRECTO",
      puntuacion: 10,
      texto: "Servicio excepcional. La suite fue perfecta para nuestra celebración de aniversario. Volveremos sin duda.",
      sentimiento: "POSITIVO",
      respondido: true,
      respuesta: "Muchas gracias Elena, fue un placer recibirles. ¡Les esperamos pronto!",
    },
    {
      reserva_idx: 1,
      canal: "BOOKING_COM",
      puntuacion: 9,
      texto: "Great room, clean and comfortable. Check-in was fast. The view from floor 3 is fantastic.",
      sentimiento: "POSITIVO",
      respondido: true,
      respuesta: "Thank you James! We look forward to welcoming you back on your next business trip.",
    },
    {
      reserva_idx: 2,
      canal: "DIRECTO",
      puntuacion: 8,
      texto: "Muy buena estadía. La habitación era cómoda y limpia. El desayuno estaba rico aunque un poco caro.",
      sentimiento: "POSITIVO",
      respondido: false,
    },
    {
      reserva_idx: 3,
      canal: "GOOGLE",
      puntuacion: 10,
      texto: "Ausgezeichneter Service! Die Suite war wunderschön. Das Personal war sehr aufmerksam und professionell.",
      sentimiento: "POSITIVO",
      respondido: true,
      respuesta: "Vielen Dank Hans! Es war eine Freude, Sie zu empfangen. Bis zum nächsten Besuch!",
    },
    {
      reserva_idx: 4,
      canal: "TRIPADVISOR",
      puntuacion: 10,
      texto: "The presidential suite exceeded all expectations. Perfect for our family vacation. Absolutely stunning!",
      sentimiento: "POSITIVO",
      respondido: true,
      respuesta: "Thank you Patricia! Your family was a delight to host. We hope to see you again soon.",
    },
    {
      reserva_idx: 5,
      canal: "DIRECTO",
      puntuacion: 7,
      texto: "Buena ubicación y habitación correcta. El wifi falla un poco en el primer piso. En general satisfecho.",
      sentimiento: "NEUTRAL",
      respondido: true,
      respuesta: "Gracias por su feedback. Ya hemos mejorado la cobertura wifi en el primer piso. ¡Esperamos verle pronto!",
    },
    {
      reserva_idx: 7,
      canal: "BOOKING_COM",
      puntuacion: 9,
      texto: "Excellent stay. Very quiet room on floor 2. Staff was helpful with restaurant recommendations.",
      sentimiento: "POSITIVO",
      respondido: false,
    },
    {
      reserva_idx: 8,
      canal: "DIRECTO",
      puntuacion: 6,
      texto: "El cuarto estuvo bien pero el aire acondicionado hizo ruido toda la noche. La atención fue amable.",
      sentimiento: "NEUTRAL",
      respondido: true,
      respuesta: "Lamentamos el inconveniente Lucas. Hemos reparado el equipo de la habitación 209. Gracias por avisarnos.",
    },
    {
      reserva_idx: 10,
      canal: "DIRECTO",
      puntuacion: 10,
      texto: "La privacidad y el servicio fueron impecables. Todo perfectamente coordinado desde la llegada.",
      sentimiento: "POSITIVO",
      respondido: true,
      respuesta: "Gracias Ahmed. Para nosotros es un privilegio recibirle. Le esperamos en su próxima visita.",
    },
    {
      reserva_idx: 11,
      canal: "DIRECTO",
      puntuacion: 9,
      texto: "Suite hermosa con terraza increíble. El spa fue un lujo. Definitivamente el mejor hotel que he visitado en Lima.",
      sentimiento: "POSITIVO",
      respondido: false,
    },
  ];

  let reviewsCreated = 0;
  for (const rv of reviewData) {
    const reserva = reservas[rv.reserva_idx];
    if (!reserva) continue;
    const def = reservaDefs[rv.reserva_idx];

    try {
      await prisma.review.create({
        data: {
          reserva_id: reserva.id,
          huesped_id: huespedes[def.huesped_idx].id,
          canal: rv.canal,
          puntuacion: rv.puntuacion,
          texto: rv.texto,
          sentimiento: rv.sentimiento,
          respondido: rv.respondido,
          respuesta: rv.respuesta,
          fecha_review: new Date(def.fecha_salida),
        },
      });
      reviewsCreated++;
    } catch {
      // Skip if already exists (re-run safety)
    }
  }

  console.log(`   ✓ ${reviewsCreated} reviews created`);

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log("\n✅ Seed complete:");
  console.log(`   Personal:     5`);
  console.log(`   Habitaciones: ${habitaciones.length}`);
  console.log(`   Huéspedes:    ${huespedes.length}`);
  console.log(`   Reservas:     ${reservas.length}`);
  console.log(`   Reviews:      ${reviewsCreated}`);
  console.log(`\n   Default password for all staff: Hotel2024!`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
