# Domtrace / Stoqly — Contexto del Proyecto

## Quién soy

Soy Javier Torres, founder. Llevo Cogelo (empresa operativa con almacén piloto). No soy desarrollador — construyo este producto con Claude como compañero técnico. Tengo visión de producto clara y voy rápido.

**Cómo trabajar conmigo:**
- Arrancar leyendo este fichero y la memoria antes de preguntar nada
- Respuestas cortas y directas. Sin bullets innecesarios
- Resolver los errores directamente, sin preguntar permiso para todo
- Mis ideas de producto son buenas — implementarlas con entusiasmo
- La continuidad importa. Trátame como alguien que ya conoces

---

## El ecosistema que estamos construyendo

| Producto | Descripción |
|---|---|
| **Stoqly Home** | App de despensa para consumidor doméstico (B2C) |
| **Stoqly Business** | Gestión de material para oficinas |
| **DomTrace** | Trazabilidad alimentaria para marcas/fabricantes (B2B) |
| **TrackRFID** | Logística B2B con albarán interactivo NFC/QR |

---

## Stack técnico

- **API**: Node.js 20 + TypeScript + Fastify → `apps/api`
- **BD**: PostgreSQL 16 + Prisma ORM (migraciones aplicadas)
- **Caché/colas**: Redis 7 + BullMQ
- **App móvil**: React Native 0.74 + Expo → `apps/mobile`
- **Panel web**: React 18 + Vite + TanStack Query → `apps/web-panel`
- **IA asistente**: Claude API (haiku) con tool calls → `/v1/stoqly/chat`
- **Voz**: ElevenLabs (prod) + expo-speech (fallback)
- **Pagos**: Stripe · **Storage**: Cloudflare R2 · **Email**: Resend

---

## Estado actual

- ✅ API corriendo en localhost:3000
- ✅ PostgreSQL + Redis en Docker
- ✅ Migraciones aplicadas
- ✅ Panel web corriendo en localhost:5173
- ✅ Widget Stoqly flotante implementado en el panel
- ✅ Login funcionando (usuario: jtorres@cogelo.es / stoqly123)
- ⏳ Pendiente: modal añadir producto, escaneo código de barras, app móvil, deploy

---

## Cómo arrancar en local

```bash
# 1. Abrir Docker Desktop → esperar círculo verde
# 2. Levantar servicios
cd "C:\app stoqly\domtrace-monorepo\infra"
docker compose up -d

# 3. Terminal 1 — API
cd "C:\app stoqly\domtrace-monorepo"
pnpm dev:api

# 4. Terminal 2 — Panel web
pnpm dev:panel
```

- API: http://localhost:3000/health
- Panel: http://localhost:5173
- Redis UI: http://localhost:8081

---

## El asistente Stoqly

- Voz: fina, suave, ligeramente tecnológica
- Toque de humor: máximo 1 por conversación
- Onboarding: 6 pasos conversacionales
- Tool calls: add_item, consume_item, discard_item, add_to_shopping_list, get_recipes, get_expiring_soon
- Módulos especiales: bebés y lactantes, medicamentos + SIGRE, cosméticos + PAO, alertas AESAN/AEMPS/RASFF, donación Banco de Alimentos

---

## Tiers

| Tier | Precio | Incluye |
|---|---|---|
| Free | Gratis | Despensa, alertas, lista básica, donación, SIGRE |
| Hogar | X,XX €/mes | + cosméticos PAO, medicamentos, ¿qué ceno?, voz, lista inteligente |
| Pro | X,XX €/mes | + Scan & Go, compra automática, multi-hogar, métricas |

---

## Marco legal importante

- **Ley 1/2025 de 1 de abril**: multas a empresas alimentarias por no medir residuos — en vigor
- **Farm to Fork (UE)**: reducción 50% desperdicio antes de 2030
- DomTrace proporciona las métricas ESG certificables que exige la ley

---

## Repositorio

- GitHub: https://github.com/javierdomtrace/domtrace-monorepo
- Carpeta local: `C:\app stoqly\domtrace-monorepo`
- Monorepo pnpm workspaces: apps/ + packages/
