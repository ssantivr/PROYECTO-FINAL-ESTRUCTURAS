import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET debe tener al menos 16 caracteres.'),
  JWT_EXPIRES_IN: z.string().default('8h'),

  AI_PROVIDER: z.enum(['lmstudio', 'none']).default('lmstudio'),
  AI_BASE_URL: z.string().url().default('http://localhost:1234/v1'),
  AI_MODEL: z.string().default(''),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).default(90000),
  AI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.3),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Variables de entorno inválidas:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
