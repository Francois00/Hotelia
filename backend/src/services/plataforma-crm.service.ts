import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

const ESTADOS_VALIDOS = [
  'nuevo', 'contactado', 'demo_agendada', 'en_prueba', 'negociacion', 'convertido', 'perdido',
] as const;

const TIPOS_INTERACCION_VALIDOS = ['llamada', 'email', 'whatsapp', 'reunion', 'nota'] as const;

export async function listarLeads() {
  return prisma.plataformaLead.findMany({ orderBy: { updated_at: 'desc' } });
}

export interface CrearLeadInput {
  nombre_contacto: string;
  nombre_empresa?: string;
  telefono?: string;
  email?: string;
  origen?: string;
  valor_estimado?: number;
  notas?: string;
  proxima_accion?: string;
  proxima_accion_fecha?: string;
}

export async function crearLead(data: CrearLeadInput) {
  return prisma.plataformaLead.create({
    data: {
      nombre_contacto: data.nombre_contacto,
      nombre_empresa: data.nombre_empresa ?? null,
      telefono: data.telefono ?? null,
      email: data.email ?? null,
      origen: data.origen ?? null,
      valor_estimado: data.valor_estimado ?? null,
      notas: data.notas ?? null,
      proxima_accion: data.proxima_accion ?? null,
      proxima_accion_fecha: data.proxima_accion_fecha ? new Date(data.proxima_accion_fecha) : null,
    },
  });
}

export interface ActualizarLeadInput extends Partial<CrearLeadInput> {
  empresa_id?: string;
}

async function obtenerLeadOThrow(id: string) {
  const lead = await prisma.plataformaLead.findUnique({ where: { id } });
  if (!lead) throw new AppError('LEAD_NO_ENCONTRADO', 404, 'Lead no encontrado');
  return lead;
}

export async function actualizarLead(id: string, data: ActualizarLeadInput) {
  await obtenerLeadOThrow(id);
  return prisma.plataformaLead.update({
    where: { id },
    data: {
      ...(data.nombre_contacto !== undefined && { nombre_contacto: data.nombre_contacto }),
      ...(data.nombre_empresa !== undefined && { nombre_empresa: data.nombre_empresa }),
      ...(data.telefono !== undefined && { telefono: data.telefono }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.origen !== undefined && { origen: data.origen }),
      ...(data.valor_estimado !== undefined && { valor_estimado: data.valor_estimado }),
      ...(data.notas !== undefined && { notas: data.notas }),
      ...(data.proxima_accion !== undefined && { proxima_accion: data.proxima_accion }),
      ...(data.proxima_accion_fecha !== undefined && {
        proxima_accion_fecha: data.proxima_accion_fecha ? new Date(data.proxima_accion_fecha) : null,
      }),
      ...(data.empresa_id !== undefined && { empresa_id: data.empresa_id }),
    },
  });
}

export async function cambiarEstadoLead(id: string, estado: string) {
  if (!ESTADOS_VALIDOS.includes(estado as (typeof ESTADOS_VALIDOS)[number])) {
    throw new AppError('ESTADO_INVALIDO', 400, `estado debe ser uno de: ${ESTADOS_VALIDOS.join(', ')}`);
  }
  await obtenerLeadOThrow(id);
  return prisma.plataformaLead.update({ where: { id }, data: { estado } });
}

export async function registrarInteraccion(leadId: string, tipo: string, descripcion: string) {
  if (!TIPOS_INTERACCION_VALIDOS.includes(tipo as (typeof TIPOS_INTERACCION_VALIDOS)[number])) {
    throw new AppError('TIPO_INVALIDO', 400, `tipo debe ser uno de: ${TIPOS_INTERACCION_VALIDOS.join(', ')}`);
  }
  await obtenerLeadOThrow(leadId);
  return prisma.plataformaLeadInteraccion.create({
    data: { lead_id: leadId, tipo, descripcion },
  });
}

export async function listarInteracciones(leadId: string) {
  await obtenerLeadOThrow(leadId);
  return prisma.plataformaLeadInteraccion.findMany({
    where: { lead_id: leadId },
    orderBy: { created_at: 'desc' },
  });
}

export async function dashboardCrm() {
  const leads = await prisma.plataformaLead.findMany({ select: { estado: true, created_at: true, proxima_accion: true, proxima_accion_fecha: true, nombre_empresa: true, id: true } });

  const porEstado: Record<string, number> = {};
  for (const estado of ESTADOS_VALIDOS) porEstado[estado] = 0;
  for (const l of leads) porEstado[l.estado] = (porEstado[l.estado] ?? 0) + 1;

  const totalLeads = leads.length;
  const convertidos = porEstado['convertido'] ?? 0;
  const tasaConversion = totalLeads > 0 ? (convertidos / totalLeads) * 100 : 0;

  const hace7Dias = new Date(Date.now() - 7 * 86_400_000);
  const leadsEstaSemana = leads.filter((l) => l.created_at >= hace7Dias).length;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const proximasAcciones = leads
    .filter((l) => l.proxima_accion_fecha && l.proxima_accion_fecha >= hoy)
    .sort((a, b) => (a.proxima_accion_fecha!.getTime() - b.proxima_accion_fecha!.getTime()))
    .slice(0, 10)
    .map((l) => ({
      lead_id: l.id,
      nombre_empresa: l.nombre_empresa,
      proxima_accion: l.proxima_accion,
      proxima_accion_fecha: l.proxima_accion_fecha,
    }));

  return {
    total_leads: totalLeads,
    por_estado: porEstado,
    tasa_conversion: Math.round(tasaConversion * 10) / 10,
    leads_esta_semana: leadsEstaSemana,
    proximas_acciones: proximasAcciones,
  };
}
