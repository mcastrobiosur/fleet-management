# Biosur Fleet Management System — Project Context

## Purpose

Digital fleet inspection and maintenance management platform. Transforms manual vehicle inspection processes into a traceable, proactive system.

**Three user roles:**
- **Conductor** (driver) — submits daily inspections via mobile app
- **Administrador** — manages fleet, assignments, reviews dashboard
- **Equipo de Mantenimiento** — handles repair tickets

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript 5.4 |
| Monorepo | npm workspaces (4 packages) |
| Backend | Node.js + Express.js 4.18 |
| Database | PostgreSQL 13+ (primary) + Redis (sessions/token blacklist) |
| Dashboard | React 18.3 + React Router 6.22 + Tailwind CSS 3.4 + Framer Motion |
| Mobile | React Native 0.76 + Expo 52 + SQLite (offline) |
| Build | Vite 5.2 (dashboard), ts-node-dev (backend) |
| Testing | Jest 29.7 + Supertest + fast-check (property-based) |
| Auth | JWT (access 1h / refresh 7d) + Redis blacklist (`bl:` prefix) |
| Storage | AWS S3 bucket `biosur-fotos` (inspection photos) |
| Real-time | WebSocket on port 3000 (`/ws`) |

---

## Architecture

**Layered architecture** with service/repository separation:

- **Presentation**: React (dashboard) + React Native (mobile)
- **API Layer**: Express routes delegate to services
- **Business Logic**: 11 services in `backend/src/services/`
- **Data Access**: PostgreSQL via `pg` driver with prepared statements
- **Cross-cutting**: RBAC middleware, JWT auth, audit logging
- **Shared Domain**: Type-safe entities/enums/DTOs in `@biosur/shared`

Key patterns:
- **Offline-first mobile** — SQLite queues pending sync, background reconciliation
- **Transactional writes** — multi-table inserts wrapped in `BEGIN/COMMIT/ROLLBACK`
- **Dependency injection** — `createApp()` factory accepts service instances for testability
- **RBAC** — `authenticate()` + `authorize(roles[])` middleware; 403s logged to `log_auditoria`

---

## Directory Structure

```
biosur_app/
├── backend/                    # Express API server (port 3000)
│   └── src/
│       ├── index.ts            # Entry: HTTP + WebSocket server
│       ├── app.ts              # Express factory, route registration
│       ├── db/
│       │   ├── pool.ts         # PostgreSQL connection pool
│       │   ├── redis.ts        # Redis client (ioredis)
│       │   ├── migrate.ts      # Migration loader
│       │   ├── migrations/     # SQL migrations (001-003)
│       │   └── seeds/          # Verification codes + test users
│       ├── middleware/
│       │   └── rbac.middleware.ts  # authenticate() + authorize()
│       ├── routes/             # 7 route files + integration tests
│       │   ├── auth.routes.ts
│       │   ├── inspeccion.routes.ts
│       │   ├── reporte-falla.routes.ts
│       │   ├── ticket.routes.ts
│       │   ├── unidad.routes.ts
│       │   ├── dashboard.routes.ts
│       │   └── asignacion.routes.ts
│       └── services/           # 11 business logic services
│           ├── auth.service.ts
│           ├── inspeccion.service.ts       # 39-code inspection logic
│           ├── reporte-falla.service.ts    # Fault reports + S3 uploads
│           ├── ticket.service.ts           # Repair ticket lifecycle
│           ├── semaforo-riesgo.service.ts  # Risk level calculation
│           ├── bloqueo.service.ts          # Unit blocking/unblocking
│           ├── hoja-vida.service.ts        # Full unit maintenance history
│           ├── bi.service.ts               # Analytics/BI queries
│           ├── sync.service.ts             # Offline sync conflict resolution
│           ├── notificacion.service.ts     # WebSocket notifications
│           └── storage.service.ts          # S3 abstraction
│
├── dashboard/                  # React admin web UI
│   └── src/
│       ├── pages/              # 7 pages: Login, FleetOverview, Calendar,
│       │                       #   Tickets, HojaVida, BI, Asignaciones
│       ├── components/         # Reusable UI (Card, Button, StatusBadge...)
│       ├── layouts/            # DashboardLayout with sidebar
│       ├── hooks/              # useAuth, useWebSocket
│       └── api/                # HTTP client
│
├── mobile/                     # React Native Expo app (offline-first)
│   └── src/
│       ├── screens/            # LoginScreen, HomeScreen, InspeccionScreen,
│       │                       #   ReporteFallaScreen
│       ├── db/                 # SQLite: pending_inspecciones, pending_reportes
│       ├── services/
│       │   └── sync-manager.ts # Core offline→online sync logic
│       ├── hooks/              # useSyncManager, useNetworkStatus
│       ├── data/               # codigos-verificacion.ts (39 codes metadata)
│       └── storage/            # expo-secure-store token persistence
│
├── shared/                     # @biosur/shared — no runtime code
│   └── src/types/
│       ├── entities.ts         # 13 domain interfaces
│       ├── enums.ts            # Rol, EstadoUnidad, NivelRiesgo, EstadoTicket...
│       ├── dtos.ts             # CrearInspeccionDTO, CrearReporteFallaDTO...
│       ├── auth.ts             # LoginRequest, AuthResponse, TokenPayload
│       └── filters.ts          # FiltroFecha, query filters
│
├── PRD.md                      # Product Requirements (Spanish, 253 lines)
├── package.json                # Monorepo root (4 workspaces)
├── tsconfig.json               # TS project references; @shared/* alias
├── jest.config.ts              # Global test config
├── .eslintrc.json              # ESLint strict TS
└── .prettierrc                 # 100 char width, trailing commas, single quotes
```

---

## Database Schema (12 tables)

`usuario`, `unidad`, `inspeccion`, `detalle_inspeccion` (39 rows per inspection), `reporte_falla`, `fotografia`, `ticket`, `historial_ticket`, `evento_bloqueo`, `log_auditoria`, `log_sync_conflicto`

---

## Key Domain Concepts

- **39 verification codes** — standardized checklist items for vehicle inspection (0 = optimal, 1–39 = specific faults)
- **Semáforo de riesgo** — red/yellow/green risk level based on fault severity
- **Bloqueo** — a unit can be blocked from operation if risk threshold exceeded
- **Hoja de vida** — complete maintenance history per unit
- **Sync conflict** — logged to `log_sync_conflicto` when offline mobile edits conflict on upload

---

## Running the App

```bash
# Install all workspaces
npm install

# DB setup (runs migrations + seeds)
npm run backend db:setup

# Dev servers
npm run backend dev     # Express API on :3000
npm run dashboard dev   # Vite dev server
npm run mobile start    # Expo CLI

# Tests
npm test                # All workspaces
npm run backend test    # Backend only
```

---

## Test Coverage

- **21 test files** (7 services + 14 routes)
- Jest + Supertest for API integration tests
- fast-check for property-based testing
- Target: 80%+ coverage per project rules
