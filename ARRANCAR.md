# Arrancar el proyecto en local

## Requisitos
- Node.js 20+
- pnpm 9+ (`npm install -g pnpm`)
- Docker Desktop (para PostgreSQL y Redis)

## 1 · Clonar e instalar

```bash
git clone https://github.com/TU_ORG/domtrace-monorepo.git
cd domtrace-monorepo
pnpm install
```

## 2 · Variables de entorno

```bash
cp .env.example apps/api/.env
# Edita apps/api/.env con tus claves
```

## 3 · Levantar base de datos y Redis

```bash
cd infra
docker compose up -d
```

Servicios disponibles:
- PostgreSQL → `localhost:5432`
- Redis → `localhost:6379`
- Redis Commander (UI) → `http://localhost:8081`

## 4 · Migraciones y seed

```bash
pnpm db:migrate   # Crea las tablas
pnpm db:seed      # Datos de prueba
pnpm db:studio    # Abre Prisma Studio en localhost:5555
```

## 5 · Arrancar la API

```bash
pnpm dev:api
# API disponible en http://localhost:3000
# Health check: GET http://localhost:3000/health
```

## 6 · Arrancar la app móvil

```bash
pnpm --filter mobile dev
# Escanea el QR con Expo Go
```

## Estructura del proyecto

```
domtrace-monorepo/
├── apps/
│   ├── api/              → API REST (Fastify + TypeScript)
│   ├── web-albaran/      → Albarán interactivo (Next.js)
│   ├── web-panel/        → Panel de marca (React + Vite)
│   └── mobile/           → App Stoqly (React Native + Expo)
├── packages/
│   ├── db/               → Prisma schema + migraciones
│   ├── types/            → Tipos TypeScript compartidos
│   ├── nfc/              → Lógica NFC/RFID compartida
│   └── ui/               → Componentes UI compartidos
└── infra/
    └── docker-compose.yml
```

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | /v1/auth/register | Registro |
| POST | /v1/auth/login | Login |
| GET | /v1/items | Lista despensa |
| POST | /v1/items | Añadir producto |
| POST | /v1/stoqly/chat | Chat con Stoqly |
| GET | /v1/tags/resolve/:tagId | Resolver tag NFC |
| GET | /v1/albaran/:epc | Ver albarán |
