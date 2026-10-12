# Clockify — Backend

Backend NestJS do Clockify NEO. Autenticação via Google OAuth (domínio corporativo único).

## Layout

```text
clockify-backend/
  server/            # projeto NestJS
  docker-compose.yml # MySQL 8 na porta 3307
```

## Pré-requisitos

- Node.js 24
- pnpm
- Docker + Docker Compose

## Instalação

```bash
pnpm --dir server install
cp server/.env.example server/.env
```

Preencha `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env`.

## Banco

```bash
docker compose up -d
pnpm db:migrate
```

MySQL 8 sobe na porta `3307` com usuário/senha `clockify`.

## Desenvolvimento

```bash
pnpm start:dev
```

- Backend: http://localhost:3000/api
- Swagger: http://localhost:3000/api/docs
- Health: http://localhost:3000/api/health

## Primeiro acesso

O usuário é criado automaticamente no primeiro login Google (claim `hd` validado contra `ALLOWED_EMAIL_DOMAIN`). A sigla (`acronym`) é derivada da parte antes do `@` no e-mail e pode ser editada por um admin depois.

Para login local sem Google (apenas desenvolvimento):

```bash
curl -X POST http://localhost:3000/api/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"seu@certi.org.br"}'
```

## Schema

Entidades: `users`, `clients`, `projects`, `tags`, `time_entries`, `time_entry_tags`.

IDs são UUID v4 em colunas `CHAR(36)`. Timestamps de timer (`started_at`, `ended_at`) usam `DATETIME(3)` em UTC.
