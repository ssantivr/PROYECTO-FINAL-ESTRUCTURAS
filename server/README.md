# ARQUILA API

Express 5 + Prisma 6 + PostgreSQL, con autenticación JWT e integración de IA con LM Studio. Comparte tipos y lógica de dominio con el frontend (`../shared`).

```bash
npm install
cp .env.example .env     # DATABASE_URL, JWT_SECRET y variables AI_*
npx prisma migrate dev   # crea la base "arquila" y las tablas
npm run db:seed          # catálogo, usuario demo (demo@arquila.co / arquila2026) y proyecto demo
npm run dev              # http://localhost:4000
npm test                 # pruebas (node:test)
```

- Endpoints y errores: [`../docs/api.md`](../docs/api.md)
- Módulos y modelo de datos: [`../docs/architecture.md`](../docs/architecture.md)
- IA y LM Studio: [`../docs/ai.md`](../docs/ai.md)
