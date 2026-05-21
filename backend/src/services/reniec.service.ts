import axios from 'axios';
import { redis } from '../lib/redis';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface DatosDNI {
  nombres:          string;
  apellidos:        string;
  fecha_nacimiento: string | null;
  direccion:        string | null;
}

export interface DatosRUC {
  razon_social: string;
  estado:       string;
  condicion:    string;
  direccion:    string | null;
  ubigeo:       string | null;
}

// ─── Consulta DNI (RENIEC) ────────────────────────────────────────────────────

/**
 * Consulta RENIEC para un DNI. Cache 24 h en Redis.
 * Retorna null si el servicio no responde o el DNI es inválido.
 */
export async function consultarDNI(dni: string): Promise<DatosDNI | null> {
  if (!/^\d{8}$/.test(dni)) return null;

  const cacheKey = `reniec:${dni}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as DatosDNI;
  } catch {
    // Redis no disponible — seguir sin cache
  }

  const apiUrl   = process.env.RENIEC_API_URL;
  const apiToken = process.env.RENIEC_API_TOKEN;

  if (!apiUrl) {
    console.warn('[reniec] RENIEC_API_URL no configurado');
    return null;
  }

  try {
    const resp = await axios.get<{
      nombres?:          string;
      apellidoPaterno?:  string;
      apellidoMaterno?:  string;
      fechaNacimiento?:  string;
      direccion?:        string;
    }>(`${apiUrl}/dni/${dni}`, {
      headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {},
      timeout: 3000,
    });

    const d     = resp.data;
    const datos: DatosDNI = {
      nombres:          d.nombres          ?? '',
      apellidos:        `${d.apellidoPaterno ?? ''} ${d.apellidoMaterno ?? ''}`.trim(),
      fecha_nacimiento: d.fechaNacimiento   ?? null,
      direccion:        d.direccion         ?? null,
    };

    try {
      await redis.set(cacheKey, JSON.stringify(datos), 'EX', 86400);
    } catch { /* non-fatal */ }

    return datos;
  } catch {
    return null;
  }
}

// ─── Consulta RUC (SUNAT) ─────────────────────────────────────────────────────

/**
 * Consulta SUNAT para un RUC. Cache 1 h en Redis.
 * Retorna null si el servicio no responde o el RUC es inválido.
 */
export async function consultarRUC(ruc: string): Promise<DatosRUC | null> {
  if (!/^\d{11}$/.test(ruc) || !/^(10|20)/.test(ruc)) return null;

  const cacheKey = `sunat:ruc:${ruc}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached) as DatosRUC;
  } catch { /* non-fatal */ }

  const apiUrl = process.env.SUNAT_API_CONSULTA_URL;
  if (!apiUrl) {
    console.warn('[sunat] SUNAT_API_CONSULTA_URL no configurado');
    return null;
  }

  try {
    const resp = await axios.get<{
      razonSocial?: string;
      estado?:      string;
      condicion?:   string;
      direccion?:   string;
      ubigeo?:      string;
    }>(`${apiUrl}/${ruc}`, { timeout: 3000 });

    const d     = resp.data;
    const datos: DatosRUC = {
      razon_social: d.razonSocial ?? '',
      estado:       d.estado      ?? '',
      condicion:    d.condicion   ?? '',
      direccion:    d.direccion   ?? null,
      ubigeo:       d.ubigeo     ?? null,
    };

    try {
      await redis.set(cacheKey, JSON.stringify(datos), 'EX', 3600);
    } catch { /* non-fatal */ }

    return datos;
  } catch {
    return null;
  }
}
