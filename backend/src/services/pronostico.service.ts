import axios from 'axios';
import { prisma } from '../lib/prisma';

const IA_SERVICE_URL = process.env.IA_SERVICE_URL ?? 'http://localhost:8001';
const IA_SECRET_KEY  = process.env.IA_SECRET_KEY  ?? '';

interface PrediccionDia {
  fecha: string;
  ocupacion_predicha: number;
  intervalo_inferior: number;
  intervalo_superior: number;
  alerta: string | null;
}

interface DiaForecast {
  fecha: string;
  ocupacion_estimada_pct: number;
  confianza: number;
}

type Tendencia = 'subiendo' | 'bajando' | 'estable';
type FactorTemporada = 'alta' | 'media' | 'baja';

function factorTemporadaDelMes(mes: number): FactorTemporada {
  // Temporada alta en el Perú: verano (dic-mar). Hombro: abr y nov. Resto: baja.
  if ([12, 1, 2, 3].includes(mes)) return 'alta';
  if ([4, 11].includes(mes)) return 'media';
  return 'baja';
}

function calcularTendencia(dias: DiaForecast[]): Tendencia {
  if (dias.length < 4) return 'estable';
  const mitad = Math.floor(dias.length / 2);
  const promedio = (arr: DiaForecast[]) => arr.reduce((acc, d) => acc + d.ocupacion_estimada_pct, 0) / arr.length;
  const inicio = promedio(dias.slice(0, mitad));
  const fin = promedio(dias.slice(mitad));
  const diff = fin - inicio;
  if (diff > 3) return 'subiendo';
  if (diff < -3) return 'bajando';
  return 'estable';
}

function generarRecomendacion(
  tendencia: Tendencia,
  factorTemporada: FactorTemporada,
  proximoEvento: { descripcion: string; impacto_estimado: string; fecha_evento: Date } | null,
): string {
  const partes: string[] = [];

  if (proximoEvento && (proximoEvento.impacto_estimado === 'alto' || proximoEvento.impacto_estimado === 'medio')) {
    const fecha = proximoEvento.fecha_evento.toLocaleDateString('es-PE', { day: 'numeric', month: 'long' });
    partes.push(
      `Se espera ${proximoEvento.impacto_estimado === 'alto' ? 'alta' : 'mayor'} demanda por "${proximoEvento.descripcion}" (${fecha}).`,
    );
    if (proximoEvento.impacto_estimado === 'alto') {
      partes.push('Considera subir tarifas 10-15% para esas fechas y revisar la disponibilidad en los canales OTA.');
    }
  }

  if (tendencia === 'subiendo') {
    partes.push('La ocupación proyectada muestra una tendencia al alza en los próximos 30 días.');
  } else if (tendencia === 'bajando') {
    partes.push('La ocupación proyectada muestra una tendencia a la baja — considera promociones o ajustar tarifas para reactivar la demanda.');
  } else {
    partes.push('La ocupación proyectada se mantiene estable en los próximos 30 días.');
  }

  if (factorTemporada === 'alta' && !partes.some((p) => p.includes('tarifas'))) {
    partes.push('Estás en temporada alta — es un buen momento para maximizar tarifas en fechas de mayor demanda.');
  } else if (factorTemporada === 'baja') {
    partes.push('Es temporada baja — evalúa paquetes o descuentos para sostener la ocupación.');
  }

  return partes.join(' ');
}

export async function pronosticoOcupacion(empresaId: string) {
  const [forecastResp, proximoEvento] = await Promise.all([
    axios
      .get<{ predicciones: PrediccionDia[] }>(`${IA_SERVICE_URL}/ia/v1/forecast`, {
        params: { dias: 30 },
        headers: { 'X-IA-Key': IA_SECRET_KEY },
        timeout: 15_000,
      })
      .then((r) => r.data)
      .catch(() => null),
    prisma.contextoMercado.findFirst({
      where: { empresa_id: empresaId, fecha_evento: { gte: new Date() } },
      orderBy: { fecha_evento: 'asc' },
    }),
  ]);

  const hoy = new Date();
  const factorTemporada = factorTemporadaDelMes(hoy.getMonth() + 1);

  if (!forecastResp) {
    return {
      proximos_30_dias: [] as DiaForecast[],
      tendencia: 'estable' as Tendencia,
      factor_temporada: factorTemporada,
      proximo_evento: proximoEvento
        ? {
            descripcion: proximoEvento.descripcion,
            fecha_evento: proximoEvento.fecha_evento.toISOString().slice(0, 10),
            impacto_estimado: proximoEvento.impacto_estimado,
          }
        : null,
      recomendacion: 'El servicio de pronóstico de IA no está disponible en este momento. Mostrando solo el contexto de mercado disponible.',
      ia_disponible: false,
    };
  }

  const proximos30Dias: DiaForecast[] = forecastResp.predicciones.map((p) => ({
    fecha: p.fecha,
    ocupacion_estimada_pct: p.ocupacion_predicha,
    confianza: Math.round(Math.max(0, 100 - (p.intervalo_superior - p.intervalo_inferior))),
  }));

  const tendencia = calcularTendencia(proximos30Dias);
  const recomendacion = generarRecomendacion(tendencia, factorTemporada, proximoEvento);

  return {
    proximos_30_dias: proximos30Dias,
    tendencia,
    factor_temporada: factorTemporada,
    proximo_evento: proximoEvento
      ? {
          descripcion: proximoEvento.descripcion,
          fecha_evento: proximoEvento.fecha_evento.toISOString().slice(0, 10),
          impacto_estimado: proximoEvento.impacto_estimado,
        }
      : null,
    recomendacion,
    ia_disponible: true,
  };
}
