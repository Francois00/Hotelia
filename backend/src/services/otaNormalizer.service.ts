import { CanalReserva } from '@prisma/client';

// ─── Normalized internal format ───────────────────────────────────────────────

export interface NormalizedReservation {
  canal_externo_id:  string;
  canal_origen:      CanalReserva;
  habitacion_numero: string;
  huesped: {
    nombre:        string;
    apellido:      string;
    email:         string;
    telefono?:     string;
    nacionalidad?: string;
  };
  fecha_entrada:  string;  // YYYY-MM-DD
  fecha_salida:   string;
  num_huespedes:  number;
  total_ota:      number;  // normalized to PEN
}

// ─── Currency helpers ─────────────────────────────────────────────────────────

function tipoCambio(currency: string): number {
  if (currency === 'EUR') return parseFloat(process.env.TIPO_CAMBIO_EUR_PEN ?? '4.10');
  if (currency === 'USD') return parseFloat(process.env.TIPO_CAMBIO_USD_PEN ?? '3.75');
  return 1;
}

function stripToNumber(s: string): number {
  return parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
}

// ─── Per-OTA normalizers ──────────────────────────────────────────────────────

export function normalizeBooking(payload: Record<string, unknown>): NormalizedReservation {
  const guest = payload.guest as Record<string, string>;
  return {
    canal_externo_id:  String(payload.booking_id),
    canal_origen:      CanalReserva.BOOKING_COM,
    habitacion_numero: String(payload.room_id),
    huesped: {
      nombre:       guest.first_name,
      apellido:     guest.last_name,
      email:        guest.email,
      telefono:     guest.phone,
      nacionalidad: guest.nationality,
    },
    fecha_entrada: String(payload.check_in),
    fecha_salida:  String(payload.check_out),
    num_huespedes: Number(payload.num_guests),
    total_ota:     Number(payload.total_amount) * tipoCambio(String(payload.currency ?? 'EUR')),
  };
}

export function normalizeExpedia(payload: Record<string, unknown>): NormalizedReservation {
  const traveler  = payload.traveler  as Record<string, string>;
  const stayDates = payload.stayDates as Record<string, string>;
  const totals    = payload.totals    as Record<string, unknown> | undefined;
  const raw       = (totals?.inclusive as Record<string, unknown>)
    ?.requestedCurrency as Record<string, string> | undefined;
  const monto = raw?.value ? parseFloat(raw.value) : 0;

  return {
    canal_externo_id:  String(payload.itineraryId),
    canal_origen:      CanalReserva.EXPEDIA,
    habitacion_numero: String(payload.roomTypeId),
    huesped: {
      nombre:   traveler.givenName,
      apellido: traveler.familyName,
      email:    traveler.email,
    },
    fecha_entrada: stayDates.checkIn,
    fecha_salida:  stayDates.checkOut,
    num_huespedes: Number(payload.adultCount),
    total_ota:     monto * tipoCambio('USD'),
  };
}

export function normalizeAirbnb(payload: Record<string, unknown>): NormalizedReservation {
  return {
    canal_externo_id:  String(payload.reservation_id),
    canal_origen:      CanalReserva.AIRBNB,
    habitacion_numero: String(payload.listing_id),
    huesped: {
      nombre:   String(payload.guest_first_name),
      apellido: String(payload.guest_last_name),
      email:    String(payload.guest_email),
    },
    fecha_entrada: String(payload.start_date),
    fecha_salida:  String(payload.end_date),
    num_huespedes: Number(payload.number_of_guests),
    total_ota:     stripToNumber(String(payload.payout_price_formatted ?? '0')) * tipoCambio('USD'),
  };
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

export function normalize(canal: string, payload: unknown): NormalizedReservation {
  const p = payload as Record<string, unknown>;
  switch (canal) {
    case 'booking': return normalizeBooking(p);
    case 'expedia': return normalizeExpedia(p);
    case 'airbnb':  return normalizeAirbnb(p);
    default: throw new Error(`Canal no soportado: ${canal}`);
  }
}
