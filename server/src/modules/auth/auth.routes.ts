import { Router } from 'express';
import { z } from 'zod';
import { authLimiter } from '../../http/rateLimit';
import { currentUser, requireAuth } from './auth.middleware';
import { authService } from './auth.service';

const email = z.string().trim().email('Correo inválido.').max(160);
const password = z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.').max(128);

const registerSchema = z.object({ name: z.string().trim().min(2, 'Ingrese su nombre.').max(120), email, password });
const loginSchema = z.object({ email, password: z.string().min(1).max(128) });

export const authRouter = Router();

authRouter.post('/register', authLimiter, async (req, res) => {
  res.status(201).json(await authService.register(registerSchema.parse(req.body)));
});

authRouter.post('/login', authLimiter, async (req, res) => {
  res.json(await authService.login(loginSchema.parse(req.body)));
});

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json(await authService.me(currentUser(req).id));
});
