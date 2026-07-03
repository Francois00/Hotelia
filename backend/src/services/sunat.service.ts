import axios from 'axios';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { obtenerFolio } from './folio.service';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface ItemComprobante {
  descripcion:    string;
  cantidad:       number;
  valor_unitario: number;
  igv_unitario:   number;
  precio_unitario: number;
}

interface DatosComprobante {
  serie:          string;
  correlativo:    string;
  fecha_emision:  string;          // YYYY-MM-DD
  cliente: {
    tipo_doc: string;              // "1"=DNI "6"=RUC "7"=CE
    num_doc:  string;
    nombre:   string;
  };
  items:          ItemComprobante[];
  total_gravado:  number;
  total_igv:      number;
  total_precio:   number;
}

// ─── XML helpers ──────────────────────────────────────────────────────────────

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildInvoiceLines(items: ItemComprobante[]): string {
  return items
    .map(
      (it, i) => `
    <cac:InvoiceLine>
      <cbc:ID>${i + 1}</cbc:ID>
      <cbc:InvoicedQuantity unitCode="NIU">${it.cantidad}</cbc:InvoicedQuantity>
      <cbc:LineExtensionAmount currencyID="PEN">${it.valor_unitario.toFixed(2)}</cbc:LineExtensionAmount>
      <cac:Item>
        <cbc:Description>${xmlEscape(it.descripcion)}</cbc:Description>
      </cac:Item>
      <cac:Price>
        <cbc:PriceAmount currencyID="PEN">${it.precio_unitario.toFixed(2)}</cbc:PriceAmount>
      </cac:Price>
    </cac:InvoiceLine>`,
    )
    .join('\n');
}

function buildXML(datos: DatosComprobante, typeCode: '01' | '03'): string {
  const ruc   = process.env.SUNAT_RUC ?? '20000000001';
  const ncom  = process.env.SUNAT_NOMBRE_COMERCIAL ?? 'Hotel';
  const dir   = process.env.SUNAT_DIRECCION ?? 'Lima';
  const serie = datos.serie;
  const corr  = datos.correlativo.padStart(8, '0');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
  xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
  xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
  xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionContent/>
    </ext:UBLExtension>
  </ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${serie}-${corr}</cbc:ID>
  <cbc:IssueDate>${datos.fecha_emision}</cbc:IssueDate>
  <cbc:InvoiceTypeCode listID="0101">${typeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>
  <cac:Signature>
    <cbc:ID>${ruc}</cbc:ID>
  </cac:Signature>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="6">${ruc}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyName>
        <cbc:Name>${xmlEscape(ncom)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${xmlEscape(dir)}</cbc:StreetName>
      </cac:PostalAddress>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="${datos.cliente.tipo_doc}">${xmlEscape(datos.cliente.num_doc)}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xmlEscape(datos.cliente.nombre)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="PEN">${datos.total_igv.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="PEN">${datos.total_gravado.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="PEN">${datos.total_igv.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cac:TaxScheme>
          <cbc:ID>1000</cbc:ID>
          <cbc:Name>IGV</cbc:Name>
          <cbc:TaxTypeCode>VAT</cbc:TaxTypeCode>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cbc:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="PEN">${datos.total_gravado.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="PEN">${datos.total_precio.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="PEN">${datos.total_precio.toFixed(2)}</cbc:PayableAmount>
  </cbc:LegalMonetaryTotal>
  ${buildInvoiceLines(datos.items)}
</Invoice>`;
}

// ─── Public functions ─────────────────────────────────────────────────────────

export function generarXMLBoleta(datos: DatosComprobante): string {
  return buildXML(datos, '03');
}

export function generarXMLFactura(datos: DatosComprobante): string {
  return buildXML(datos, '01');
}

export function firmarXML(xml: string): string {
  console.warn('[sunat] XML sin firma — usar certificado real en producción');
  return xml.replace(
    '<ext:ExtensionContent/>',
    '<ext:ExtensionContent><!-- FIRMA_DIGITAL_PENDIENTE --></ext:ExtensionContent>',
  );
}

export async function enviarSUNAT(
  xmlFirmado: string,
  tipo: 'BOLETA' | 'FACTURA',
): Promise<{ cdr_estado: string; descripcion: string }> {
  const env     = process.env.SUNAT_ENV ?? 'beta';
  const usuario = process.env.SUNAT_USUARIO_SOL ?? '';
  const clave   = process.env.SUNAT_CLAVE_SOL ?? '';
  const ruc     = process.env.SUNAT_RUC ?? '';

  if (!usuario || !clave || !ruc) {
    console.warn('[sunat] Credenciales no configuradas — retornando respuesta simulada');
    return { cdr_estado: '0', descripcion: `La ${tipo} ha sido aceptada (simulado)` };
  }

  const endpoint =
    env === 'produccion'
      ? 'https://e-factura.sunat.gob.pe/ol-ti-itcpe/billService'
      : 'https://e-beta.sunat.gob.pe/ol-ti-itcpe/billService';

  const xmlB64  = Buffer.from(xmlFirmado).toString('base64');
  const soapEnv = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:ser="http://service.sunat.gob.pe"
  xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <soapenv:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>${ruc}${usuario}</wsse:Username>
        <wsse:Password>${clave}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <ser:sendBill>
      <fileName>comprobante.xml</fileName>
      <contentFile>${xmlB64}</contentFile>
    </ser:sendBill>
  </soapenv:Body>
</soapenv:Envelope>`;

  try {
    const { data } = await axios.post<string>(endpoint, soapEnv, {
      headers: { 'Content-Type': 'text/xml;charset=UTF-8', SOAPAction: '' },
      timeout: 15000,
    });

    const hasError = /<faultstring>/.test(data);
    if (hasError) {
      const match = data.match(/<faultstring>(.*?)<\/faultstring>/s);
      return { cdr_estado: '1', descripcion: match?.[1] ?? 'Error SUNAT' };
    }
    return { cdr_estado: '0', descripcion: `La ${tipo} ha sido aceptada` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[sunat] enviarSUNAT error:', msg);
    const error = new AppError('SUNAT_NO_DISPONIBLE', 503, 'SUNAT no disponible — el comprobante se marcará para reintento');
    throw error;
  }
}

// ─── Auto-increment correlativo (por local, bajo FOR UPDATE) ─────────────────
// Antes: MAX(correlativo)+1 global sin lock — condición de carrera real y, con
// multi-local, un contador compartido entre locales. Ahora: cada local tiene su
// propia fila en contabilidad_config con serie/correlativo independientes,
// incrementados atómicamente bajo FOR UPDATE (espera, no NOWAIT — aquí sí
// queremos que la segunda transacción espere en vez de fallar).

async function siguienteCorrelativo(
  tipo: 'BOLETA' | 'FACTURA',
  localId: string,
): Promise<{ serie: string; correlativo: string }> {
  const campoSerie = tipo === 'BOLETA' ? 'serie_boleta' : 'serie_factura';
  const campoCorr  = tipo === 'BOLETA' ? 'correlativo_boleta' : 'correlativo_factura';

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ serie: string; correlativo: number }>>`
      SELECT ${Prisma.raw(campoSerie)} AS serie, ${Prisma.raw(campoCorr)} AS correlativo
      FROM contabilidad_config
      WHERE local_id = ${localId}::uuid
      FOR UPDATE
    `;

    if (rows.length === 0) {
      throw new AppError(
        'CONFIG_CONTABLE_NO_ENCONTRADA',
        500,
        `No existe configuración contable (contabilidad_config) para el local ${localId}`,
      );
    }

    const nuevoNumero = rows[0].correlativo + 1;

    await tx.$executeRaw`
      UPDATE contabilidad_config
      SET ${Prisma.raw(campoCorr)} = ${nuevoNumero}
      WHERE local_id = ${localId}::uuid
    `;

    return { serie: rows[0].serie, correlativo: String(nuevoNumero).padStart(8, '0') };
  });
}

// ─── Main emitter ─────────────────────────────────────────────────────────────

export async function emitirComprobante(reserva_id: string) {
  const folio = await obtenerFolio(reserva_id);

  const reserva = await prisma.reserva.findUnique({
    where:  { id: reserva_id },
    select: {
      huesped: {
        select: {
          nombre:           true,
          apellido:         true,
          numero_documento: true,
          tipo_documento:   true,
        },
      },
      habitacion: { select: { local_id: true } },
    },
  });
  if (!reserva) throw new AppError('RESERVA_NOT_FOUND', 404, 'Reserva no encontrada');

  const { huesped } = reserva;
  const tipo: 'BOLETA' | 'FACTURA' =
    huesped.tipo_documento === 'DNI' || huesped.tipo_documento === 'PASAPORTE'
      ? 'BOLETA'
      : 'FACTURA';

  const tipoDocMap: Record<string, string> = { DNI: '1', PASAPORTE: '7', CE: '4' };
  const tipoDocSunat = tipoDocMap[huesped.tipo_documento] ?? '1';

  const total      = folio.total_cargos;
  const gravado    = parseFloat((total / 1.18).toFixed(2));
  const igv        = parseFloat((total - gravado).toFixed(2));

  const items: ItemComprobante[] = folio.items
    .filter((i) => !i.anulado)
    .map((i) => {
      const vu  = parseFloat((i.precio_unitario / 1.18).toFixed(2));
      const igvU = parseFloat((i.precio_unitario - vu).toFixed(2));
      return {
        descripcion:     i.descripcion,
        cantidad:        i.cantidad,
        valor_unitario:  vu,
        igv_unitario:    igvU,
        precio_unitario: i.precio_unitario,
      };
    });

  const { serie, correlativo } = await siguienteCorrelativo(tipo, reserva.habitacion.local_id);
  const fecha_emision = new Date().toISOString().slice(0, 10);

  const datos: DatosComprobante = {
    serie,
    correlativo,
    fecha_emision,
    cliente: {
      tipo_doc: tipoDocSunat,
      num_doc:  huesped.numero_documento,
      nombre:   `${huesped.nombre} ${huesped.apellido}`,
    },
    items,
    total_gravado: gravado,
    total_igv:     igv,
    total_precio:  total,
  };

  const xmlRaw    = tipo === 'BOLETA' ? generarXMLBoleta(datos) : generarXMLFactura(datos);
  const xmlFirmado = firmarXML(xmlRaw);

  let cdr: { cdr_estado: string; descripcion: string } = { cdr_estado: '1', descripcion: 'No enviado' };
  let estado: string = 'PENDIENTE';

  try {
    cdr    = await enviarSUNAT(xmlFirmado, tipo);
    estado = cdr.cdr_estado === '0' ? 'EMITIDO' : 'ERROR_SUNAT';
  } catch {
    estado = 'ERROR_SUNAT';
  }

  const comprobante = await prisma.comprobante.upsert({
    where:  { reserva_id },
    create: {
      reserva_id,
      tipo,
      serie,
      correlativo,
      fecha_emision: new Date(fecha_emision),
      total,
      xml_generado:  xmlFirmado,
      cdr_respuesta: cdr.descripcion,
      estado,
    },
    update: {
      tipo,
      serie,
      correlativo,
      fecha_emision: new Date(fecha_emision),
      total,
      xml_generado:  xmlFirmado,
      cdr_respuesta: cdr.descripcion,
      estado,
    },
    select: { id: true, tipo: true, serie: true, correlativo: true, estado: true },
  });

  return {
    comprobante_id:    comprobante.id,
    tipo:              comprobante.tipo,
    serie_correlativo: `${comprobante.serie}-${comprobante.correlativo}`,
    estado:            comprobante.estado,
    pdf_url:           null,
  };
}

export async function obtenerComprobantePorReserva(reserva_id: string, localId?: string | null) {
  const c = await prisma.comprobante.findUnique({
    where:  { reserva_id },
    select: {
      id: true, tipo: true, serie: true, correlativo: true,
      fecha_emision: true, total: true, estado: true, pdf_url: true, created_at: true,
      reserva: { select: { habitacion: { select: { local_id: true } } } },
    },
  });
  if (!c || (localId && c.reserva.habitacion.local_id !== localId)) {
    throw new AppError('COMPROBANTE_NOT_FOUND', 404, 'Comprobante no encontrado');
  }
  const { reserva: _reserva, ...rest } = c;
  return { ...rest, total: Number(c.total) };
}

export async function listarComprobantes(filtros: {
  tipo?: string; estado?: string; desde?: string; hasta?: string; page?: number; limit?: number; localId?: string | null;
}) {
  const page  = filtros.page  ?? 1;
  const limit = Math.min(filtros.limit ?? 20, 100);

  const where: Record<string, unknown> = {};
  if (filtros.tipo)   where.tipo   = filtros.tipo;
  if (filtros.estado) where.estado = filtros.estado;
  if (filtros.localId) where.reserva = { habitacion: { local_id: filtros.localId } };
  if (filtros.desde || filtros.hasta) {
    where.fecha_emision = {
      ...(filtros.desde ? { gte: new Date(filtros.desde) } : {}),
      ...(filtros.hasta ? { lte: new Date(filtros.hasta) } : {}),
    };
  }

  const [total, comprobantes] = await Promise.all([
    prisma.comprobante.count({ where: where as never }),
    prisma.comprobante.findMany({
      where:   where as never,
      orderBy: { fecha_emision: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
      select: {
        id: true, tipo: true, serie: true, correlativo: true,
        fecha_emision: true, total: true, estado: true, created_at: true,
        reserva: { select: { codigo: true, huesped: { select: { nombre: true, apellido: true } } } },
      },
    }),
  ]);

  return {
    data: comprobantes.map((c) => ({ ...c, total: Number(c.total) })),
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
