import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { RolPersonal } from '@prisma/client';
import { AuthPayload } from '../middleware/auth';

// ─── Role → Socket.IO room mapping ───────────────────────────────────────────

const ROLE_ROOMS: Record<RolPersonal, string[]> = {
  [RolPersonal.ADMIN]:         ['dashboard'],
  [RolPersonal.GERENTE]:       ['dashboard'],
  [RolPersonal.RECEPCIONISTA]: ['recepcion'],
  [RolPersonal.HOUSEKEEPING]:  ['housekeeping'],
  [RolPersonal.MANTENIMIENTO]: ['mantenimiento'],
};

// ─── Singleton ────────────────────────────────────────────────────────────────

let _io: Server | null = null;

export function initSocket(server: HTTPServer): Server {
  _io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL ?? '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  // JWT auth middleware
  _io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      return next(new Error('TOKEN_REQUERIDO'));
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) return next(new Error('JWT_SECRET not set'));
    try {
      const payload = jwt.verify(token, secret) as AuthPayload;
      socket.data.user = payload;
      next();
    } catch {
      next(new Error('TOKEN_INVALIDO'));
    }
  });

  _io.on('connection', (socket: Socket) => {
    const user = socket.data.user as AuthPayload;
    const rooms = ROLE_ROOMS[user.rol] ?? [];
    rooms.forEach((room) => socket.join(room));
    socket.emit('connected', { rooms });

    socket.on('disconnect', () => {
      // no-op
    });
  });

  return _io;
}

export function emit(event: string, data: unknown, room: string): void {
  if (_io) {
    _io.to(room).emit(event, data);
  }
}

export function emitMulti(event: string, data: unknown, rooms: string[]): void {
  if (_io) {
    rooms.forEach((room) => _io!.to(room).emit(event, data));
  }
}

export function getIO(): Server {
  if (!_io) throw new Error('Socket.IO not initialized');
  return _io;
}
