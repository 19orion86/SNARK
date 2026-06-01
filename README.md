# Корпоративный портал СНАРК

Внутренний портал компании: справочник сотрудников, новости, документы, заявки, бронирование, админ-панель.
Стек: Next.js 16 (App Router) · TypeScript · Tailwind + shadcn/ui · PostgreSQL (Drizzle ORM) · MinIO (S3) · аутентификация на JWT.

> Все секреты живут в `.env.local` — он **не** попадает в git. Локально и на сервере он свой.

---

## Локальный запуск (разработка)

Инфраструктура (БД + хранилище) поднимается в Docker, само приложение — нативно через `pnpm dev` с горячей перезагрузкой.

**Требуется:** Node.js 22 LTS, pnpm, Docker Desktop.

1. Поднять PostgreSQL и MinIO:
   docker compose up -d
2. Создать `.env.local` на основе `.env.example`:
   DATABASE_URL=postgres://portal_dev:ПАРОЛЬ@localhost:5432/portal_dev
   USE_MOCK_DB=false
   JWT_ACCESS_SECRET=<openssl rand -hex 32>
   JWT_REFRESH_SECRET=<openssl rand -hex 32>
   S3_ENDPOINT=http://localhost:9000
   S3_REGION=ru-central-1
   S3_BUCKET=snark-portal
   S3_ACCESS_KEY_ID=minioadmin
   S3_SECRET_ACCESS_KEY=minioadmin123
3. Создать бакет: http://localhost:9001 (minioadmin / minioadmin123) → Buckets → Create Bucket → `snark-portal` → Access Policy: Public.
4. Установить и подготовить БД:
   pnpm install
   pnpm db:migrate
   pnpm init:users
5. Запустить:
   pnpm dev
   Портал: http://localhost:3000

---

## Сервер (Windows, продакшен)

На сервере всё нативное, **без Docker**: PostgreSQL и MinIO установлены как программы Windows, приложение держит PM2 через `next start` против production-сборки. Standalone-режим не используется.

### Выкатка обновлений
    cd C:\apps\snark-portal
    git pull origin main
    pnpm install        # если менялись зависимости или .npmrc
    pnpm db:migrate     # если были новые миграции (сделай бэкап БД заранее!)
    pnpm build
    pm2 restart snark-portal

Адреса: портал — http://<IP-сервера>:3000, MinIO-консоль — http://localhost:9001

### Живёт только на сервере (нет в git)
- `.env.local` — секреты. На HTTP-сервере обязательно `COOKIE_SECURE=false`.
- `ecosystem.config.js` — конфиг PM2 с путями сервера.

### Управление процессом
    pm2 status
    pm2 logs snark-portal
    pm2 restart snark-portal
    pm2 save
