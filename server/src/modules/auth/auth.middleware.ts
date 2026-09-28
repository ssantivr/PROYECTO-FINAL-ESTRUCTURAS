import type { Request, RequestHandler } from 'express';
import { HttpError } from '../../http/errors';
import { verifyToken, type AuthUser } from './auth.service';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    next(new HttpError(401, 'Debe iniciar sesión para usar este recurso.'));
    return;
  }
  req.user = verifyToken(token);
  next();
};

export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new HttpError(401, 'Debe iniciar sesión para usar este recurso.');
  return req.user;
}
