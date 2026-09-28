import jwt from 'jsonwebtoken';
import { env } from '../../config/env';
import { prisma } from '../../db/prisma';
import { HttpError } from '../../http/errors';
import { hashPassword, verifyPassword } from './password';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ email: user.email, name: user.name }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): AuthUser {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    if (typeof payload === 'string' || !payload.sub) throw new Error('payload');
    return { id: payload.sub, email: String(payload['email']), name: String(payload['name']) };
  } catch {
    throw new HttpError(401, 'Sesión inválida o expirada. Inicie sesión de nuevo.');
  }
}

const toUser = (u: { id: string; email: string; name: string }): AuthUser => ({ id: u.id, email: u.email, name: u.name });

export const authService = {
  async register(input: { name: string; email: string; password: string }): Promise<AuthSession> {
    const email = input.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) {
      throw new HttpError(409, 'Ya existe una cuenta con ese correo.');
    }
    const user = await prisma.user.create({
      data: { name: input.name, email, passwordHash: await hashPassword(input.password) },
    });
    return { token: signToken(toUser(user)), user: toUser(user) };
  },

  async login(input: { email: string; password: string }): Promise<AuthSession> {
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new HttpError(401, 'Correo o contraseña incorrectos.');
    }
    return { token: signToken(toUser(user)), user: toUser(user) };
  },

  async me(id: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new HttpError(401, 'La cuenta ya no existe.');
    return toUser(user);
  },
};
