import { env } from './config/env';
import { prisma } from './db/prisma';
import { createApp } from './app';

const server = createApp().listen(env.PORT, () => {
  console.log(`ARQUILA API escuchando en http://localhost:${env.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`${signal} recibido, cerrando…`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
