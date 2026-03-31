# STACK.md — Tech Stack & Docker Details

## Backend

| Item | Detail |
|---|---|
| Language | PHP 8.3 |
| Framework | Laravel 13 |
| Auth | Laravel Sanctum (API tokens) |
| ORM | Eloquent |
| Database | MySQL 8.0 |
| Container | `php:8.3-fpm-alpine` |
| Port | 8000 |

### Key Backend Packages
- `laravel/sanctum ^4.0` — stateless API token authentication
- `laravel/tinker ^3.0` — interactive REPL
- `fakerphp/faker ^1.23` — seeder data
- `phpunit/phpunit ^12.5.12` — testing

### Backend Entry Points
- `backend/routes/api.php` — all 86 API routes
- `backend/app/Http/Controllers/` — 14 controllers
- `backend/app/Models/` — 19 Eloquent models
- `backend/app/Http/Middleware/CheckPermission.php` — RBAC middleware
- `backend/app/Observers/` — 3 model observers (auto side-effects)
- `backend/database/seeders/` — initial seed data

---

## Frontend

| Item | Detail |
|---|---|
| Language | TypeScript |
| Framework | React 18 |
| Build Tool | Vite + Bun |
| Routing | React Router DOM v6 |
| UI Kit | shadcn/ui (Radix UI + Tailwind) |
| Styling | TailwindCSS v3 |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Animations | Framer Motion |
| HTTP | Custom apiClient.ts (fetch wrapper) |
| Toasts | Sonner |
| Icons | Lucide React |
| Container | `oven/bun:1` |
| Port | 5173 |

### Key Frontend Packages
- `@tanstack/react-query ^5.83.0` — installed but not yet wired up
- `react-hook-form ^7.61.1` — form state management
- `zod ^3.25.76` — form schema validation
- `recharts ^2.15.4` — bar/line charts
- `framer-motion ^11.0.0` — page transitions
- `sonner ^1.7.4` — toast notifications

### Frontend Entry Points
- `frontend/src/lib/apiClient.ts` — HTTP client (auth header, snake↔camel, 401 handler)
- `frontend/src/contexts/AuthContext.tsx` — auth state, `hasPermission()`
- `frontend/src/models/types.ts` — all TypeScript interfaces and enums
- `frontend/src/services/` — 13 API service modules
- `frontend/src/pages/` — 16 page components

---

## Docker Setup

### docker-compose.yml — 3 Services

#### `backend` service
```yaml
build: ./backend/Dockerfile       # php:8.3-fpm-alpine
container_name: fromagerie_backend
ports: "8000:8000"
volumes: ./backend:/var/www/html   # live reload
environment:
  APP_ENV: local
  DB_CONNECTION: mysql
  DB_HOST: db                      # internal service name
  DB_DATABASE: fromagerie
  DB_USERNAME: fromagerie
  DB_PASSWORD: secret
  SANCTUM_STATELESS_DOMAINS: localhost:5173
  FRONTEND_URL: http://localhost:5173
depends_on: db (service_healthy)
```

#### `frontend` service
```yaml
build: ./frontend/Dockerfile       # oven/bun:1
container_name: fromagerie_frontend
ports: "5173:8080"                  # NOTE: internal port is 8080
volumes: ./frontend:/app
environment:
  VITE_API_URL: http://localhost:8000/api
depends_on: backend
```
> **Note:** Frontend container exposes port 8080 internally, mapped to 5173 on host.

#### `db` service
```yaml
image: mysql:8.0
container_name: fromagerie_db
ports: "33061:3306"
environment:
  MYSQL_DATABASE: fromagerie
  MYSQL_USER: fromagerie
  MYSQL_PASSWORD: secret
  MYSQL_ROOT_PASSWORD: rootsecret
healthcheck: mysqladmin ping every 5s (15 retries)
```

### Docker Commands
```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Run artisan commands
docker exec fromagerie_backend php artisan migrate
docker exec fromagerie_backend php artisan migrate:refresh --seed
docker exec fromagerie_backend php artisan tinker

# Shell into container
docker exec -it fromagerie_backend sh
docker exec -it fromagerie_frontend sh
```

---

## Environment Variables

### Backend (set in docker-compose.yml, override .env)
```
APP_NAME=Fromagerie
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost:8000
DB_CONNECTION=mysql
DB_HOST=db
DB_PORT=3306
DB_DATABASE=fromagerie
DB_USERNAME=fromagerie
DB_PASSWORD=secret
SANCTUM_STATELESS_DOMAINS=localhost:5173
FRONTEND_URL=http://localhost:5173
```

### Frontend
```
VITE_API_URL=http://localhost:8000/api
```

---

## API Communication Pattern

1. Frontend `apiClient.ts` attaches `Authorization: Bearer <token>` from localStorage
2. Converts outgoing request body from camelCase to snake_case
3. Converts incoming response from snake_case to camelCase
4. On 401 response: dispatches `auth:unauthorized` event → `AuthContext` clears session
5. Backend `auth:sanctum` middleware validates the token
6. Backend `CheckPermission` middleware enforces `module.read` / `module.write` rules
