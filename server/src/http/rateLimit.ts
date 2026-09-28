import { rateLimit } from 'express-rate-limit';

const message = (what: string) => ({ error: `Demasiadas solicitudes de ${what}. Intente de nuevo en unos minutos.` });

export const apiLimiter = rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false, message: message('la API') });

export const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: message('inicio de sesión') });

export const aiLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false, message: message('IA') });
