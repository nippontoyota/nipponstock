# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AutoStock — a full-stack automotive inventory/stock management app. Two distinct user roles: **ADMIN** and **SALES_MANAGER**, each with separate UI shells and route guards.

## Commands

### Root (run both services together)
```bash
npm run install:all      # Install all dependencies (frontend + backend)
npm run dev:backend      # Start backend dev server
npm run dev:frontend     # Start frontend dev server
npm run build            # Build both
```

### Frontend (`cd frontend`)
```bash
npm run dev              # Vite dev server on port 5173
npm run build            # tsc + vite build
npm run preview          # Preview production build
```

### Backend (`cd backend`)
```bash
npm run dev              # ts-node-dev with auto-respawn on port 4000
npm run build            # tsc compilation to dist/
npm run start            # Run compiled dist/index.js
npm run db:migrate       # Run Prisma migrations
npm run db:generate      # Regenerate Prisma client
npm run db:seed          # Seed database
npm run db:studio        # Open Prisma Studio GUI
```

No test suite configured.

## Architecture

### Frontend (`frontend/src/`)

- **`App.tsx`** — Router with role-based route guards using `AuthContext`
- **`api.ts`** — Axios instance; injects JWT from localStorage, auto-logouts on 401
- **`socket.ts`** — Socket.IO client for real-time heatmap and blocking updates
- **`context/AuthContext.tsx`** — Global auth state (user, token, login/logout). Token persisted to localStorage.
- **`layouts/`** — `AdminShell` and `SalesShell` nav wrappers
- **`pages/`** — Page components split under `admin/` and `sales/` subdirectories

Dev API proxy: Vite rewrites `/api/*` → `http://localhost:4000` (configured in `vite.config.ts`). Production uses `VITE_API_URL` env var.

### Backend (`backend/src/`)

- **`index.ts`** — Express + Socket.IO server entry point
- **`middleware/auth.ts`** — JWT verification + role-based authorization middleware
- **`lib/`** — Shared utilities: Prisma client singleton, JWT helpers, bcrypt wrappers
- **`routes/`** — Route modules: `auth`, `stock`, `blocking`, `analytics`, `config`, `users`, `branches`, `cars`
- **`services/`** — Business logic: `events.ts` (Socket.IO emission), `expiry.ts` (node-cron job for blocking expiry), `heatmap.ts`, `modelDuration.ts`, `audit.ts`
- **`prisma/`** — Schema + migrations (PostgreSQL)

### Key Data Flow Patterns

- HTTP calls go through `frontend/src/api.ts` (Axios with JWT interceptor)
- Real-time updates pushed from backend via Socket.IO events, consumed in `frontend/src/socket.ts`
- Backend validates all input with **Zod** schemas before hitting the database
- All DB access goes through the Prisma client singleton in `backend/src/lib/`
- Role checks use the `authorize(role)` middleware from `backend/src/middleware/auth.ts`

### Database Models (key concepts)

- `User` — has a role (ADMIN/SALES_MANAGER) and belongs to a `Branch`
- `Stock` / `Vehicle` — cars available at branches
- `Blocking` — sales manager reserves a vehicle (soft/hard, with configurable expiry per model)
- `ModelConfig` — per-model blocking duration settings managed by admin
- `AuditLog` — trail of all blocking state changes

## Tech Stack

| Layer | Stack |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Routing | React Router v6 |
| HTTP client | Axios |
| Real-time | Socket.IO |
| Charts | Recharts |
| Excel | XLSX |
| Notifications | React Hot Toast |
| Backend | Node.js, Express, TypeScript |
| ORM | Prisma 5 |
| Database | PostgreSQL |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Validation | Zod |
| Scheduled jobs | node-cron |
