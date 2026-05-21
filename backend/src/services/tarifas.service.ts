import { TipoHabitacion, TipoTemporada } from '@prisma/client';
import { prisma } from '../lib/prisma';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface HabitacionTarifa {
  id:            string;
  tipo:          TipoHabitacion;
  tipo_custom_id: string | null;
  tarifa_base:   number;
  tarifa_minima: number | null;
  tarifa_maxima: number | null;
}

interface ReglaAplicable {
  tipo:                 TipoTemporada;
  ajuste_porcentaje:    number;
  estadia_minima_noches: number | null;
}

// Peso de prioridad por tipo de regla (mayor = gana)
const PRIORIDAD: Record<TipoTemporada, number> = {
  EVENTO_ESPECIAL:  4,
  TEMPORADA_ALTA:   3,
  TEMPORADA_BAJA:   3,
  FIN_DE_SEMANA:    2,
  ESTADIA_LARGA:    1,
};

function calcNumNoches(entrada: Date, salida: Date): number {
  return Math.round((salida.getTime() - entrada.getTime()) / 86_400_000);
}

function hayFinDeSemana(entrada: Date, salida: Date): boolean {
  const d = new Date(entrada);
  while (d < salida) {
    const dow = d.getDay(); // 0=Dom, 6=Sáb
    if (dow === 0 || dow === 6) return true;
    d.setDate(d.getDate() + 1);
  }
  return false;
}

function tipoCoincide(aplica_a_tipos: unknown, habitacion: HabitacionTarifa): boolean {
  if (!Array.isArray(aplica_a_tipos) || aplica_a_tipos.length === 0) return true;
  return (
    aplica_a_tipos.includes(habitacion.tipo) ||
    (habitacion.tipo_custom_id !== null && aplica_a_tipos.includes(habitacion.tipo_custom_id))
  );
}

// ─── API pública ──────────────────────────────────────────────────────────────

export async function obtenerReglasAplicables(
  habitacion: HabitacionTarifa,
  fechaEntrada: Date,
  fechaSalida: Date,
): Promise<ReglaAplicable[]> {
  const noches = calcNumNoches(fechaEntrada, fechaSalida);
  const conFinDeSemana = hayFinDeSemana(fechaEntrada, fechaSalida);

  const reglas = await prisma.reglaTemporada.findMany({
    where: { activo: true },
    select: {
      tipo:                 true,
      fecha_inicio:         true,
      fecha_fin:            true,
      ajuste_porcentaje:    true,
      estadia_minima_noches: true,
      aplica_a_tipos:       true,
    },
  });

  const aplicables: ReglaAplicable[] = [];

  for (const regla of reglas) {
    if (!tipoCoincide(regla.aplica_a_tipos, habitacion)) continue;

    let aplica = false;

    switch (regla.tipo) {
      case TipoTemporada.TEMPORADA_ALTA:
      case TipoTemporada.TEMPORADA_BAJA:
      case TipoTemporada.EVENTO_ESPECIAL:
        // La regla aplica si el rango de fechas solapa con el periodo de la regla
        if (regla.fecha_inicio && regla.fecha_fin) {
          aplica =
            fechaEntrada < new Date(regla.fecha_fin) &&
            fechaSalida  > new Date(regla.fecha_inicio);
        }
        break;

      case TipoTemporada.FIN_DE_SEMANA:
        aplica = conFinDeSemana;
        break;

      case TipoTemporada.ESTADIA_LARGA:
        aplica =
          regla.estadia_minima_noches !== null &&
          noches >= regla.estadia_minima_noches;
        break;
    }

    if (aplica) {
      aplicables.push({
        tipo:                 regla.tipo,
        ajuste_porcentaje:    Number(regla.ajuste_porcentaje),
        estadia_minima_noches: regla.estadia_minima_noches,
      });
    }
  }

  // Ordenar por prioridad descendente; misma prioridad → mayor |ajuste| primero
  aplicables.sort((a, b) => {
    const dp = PRIORIDAD[b.tipo] - PRIORIDAD[a.tipo];
    if (dp !== 0) return dp;
    return Math.abs(b.ajuste_porcentaje) - Math.abs(a.ajuste_porcentaje);
  });

  return aplicables;
}

/**
 * Calcula la tarifa ajustada de una habitación para un rango de fechas
 * aplicando la regla de mayor prioridad entre las activas.
 * Resultado siempre está entre tarifa_minima y tarifa_maxima (si están definidas).
 */
export async function calcularTarifaConReglas(
  habitacion: HabitacionTarifa,
  fechaEntrada: Date,
  fechaSalida: Date,
): Promise<number> {
  const reglas = await obtenerReglasAplicables(habitacion, fechaEntrada, fechaSalida);
  let precio = habitacion.tarifa_base;

  if (reglas.length > 0) {
    const regla = reglas[0]; // mayor prioridad
    precio = precio * (1 + regla.ajuste_porcentaje / 100);
  }

  const min = habitacion.tarifa_minima ?? 0;
  const max = habitacion.tarifa_maxima ?? Infinity;

  return Math.min(max, Math.max(min, Math.round(precio * 100) / 100));
}
