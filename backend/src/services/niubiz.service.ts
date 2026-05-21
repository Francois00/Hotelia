import axios from 'axios';
import { redis } from '../lib/redis';

const REDIS_KEY = 'niubiz:token';

function apiUrl(): string {
  const env = process.env.NIUBIZ_ENV ?? 'sandbox';
  return env === 'production'
    ? (process.env.NIUBIZ_API_URL_PROD ?? 'https://apiprod.vnforapps.com')
    : (process.env.NIUBIZ_API_URL_SANDBOX ?? 'https://apisandbox.vnforapps.com');
}

function merchantId(): string {
  const id = process.env.NIUBIZ_MERCHANT_ID;
  if (!id) throw new Error('NIUBIZ_MERCHANT_ID no configurado');
  return id;
}

export async function obtenerToken(): Promise<string> {
  const cached = await redis.get(REDIS_KEY);
  if (cached) return cached;

  const user = process.env.NIUBIZ_USER ?? '';
  const pass = process.env.NIUBIZ_PASSWORD ?? '';
  const credentials = Buffer.from(`${user}:${pass}`).toString('base64');

  const { data } = await axios.post<string>(
    `${apiUrl()}/api.security/v1/security`,
    null,
    { headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/json' } },
  );

  const token = typeof data === 'string' ? data : (data as { access_token: string }).access_token;
  await redis.set(REDIS_KEY, token, 'EX', 14 * 60);
  return token;
}

export async function crearSesionPago(
  montoCentimos: number,
  transaccionId: string,
): Promise<{ sessionKey: string; expirationTime: string }> {
  const token  = await obtenerToken();
  const monto  = montoCentimos / 100;
  const mid    = merchantId();

  const { data } = await axios.post<{ sessionKey: string; expirationTime: string }>(
    `${apiUrl()}/api.ecommerce/v2/ecommerce/token/session/${mid}`,
    {
      amount:     monto,
      antifraud: {
        clientIp:            '127.0.0.1',
        merchantDefineData:  { MDD4: transaccionId },
      },
      channel:        'web',
      countable:      true,
      purchaseNumber: transaccionId,
    },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
  );

  return { sessionKey: data.sessionKey, expirationTime: data.expirationTime };
}

export interface NiubizPagoResult {
  transactionId:     string;
  authorizationCode: string;
  actionCode:        string;
  approved:          boolean;
}

export async function procesarPago(
  sessionKey: string,
  transaccionId: string,
  montoCentimos: number,
  email: string,
): Promise<NiubizPagoResult> {
  const token = await obtenerToken();
  const monto = montoCentimos / 100;
  const mid   = merchantId();

  const { data } = await axios.post<{
    dataMap: {
      TRANSACTION_ID: string;
      AUTHORIZATION_CODE: string;
      ACTION_CODE: string;
    };
  }>(
    `${apiUrl()}/api.authorization/v3/authorization/ecommerce/${mid}`,
    {
      captureType: 'manual',
      channel:     'web',
      countable:   true,
      order: {
        purchaseNumber: transaccionId,
        amount:         monto,
        currency:       'PEN',
        productId:      '1',
      },
      // sessionKey passed via header in real integration; some versions accept in body
      sessionToken: sessionKey,
    },
    {
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );

  const { TRANSACTION_ID, AUTHORIZATION_CODE, ACTION_CODE } = data.dataMap;
  const approved = ACTION_CODE === '000';

  if (!approved) {
    const err = new Error(`Pago rechazado por Niubiz (ACTION_CODE: ${ACTION_CODE})`);
    (err as Error & { code: string }).code = 'PAGO_RECHAZADO';
    throw err;
  }

  return {
    transactionId:     TRANSACTION_ID,
    authorizationCode: AUTHORIZATION_CODE,
    actionCode:        ACTION_CODE,
    approved,
  };
}
