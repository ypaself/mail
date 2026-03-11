# CLAUDE.md — AI Assistant Guide for the Mail Application

## Project Overview

This is a **full-stack Gmail-clone web application** built as a TypeScript monorepo. It features a React 19 frontend and an Express/Node.js backend, backed by PostgreSQL. The app includes email management, custom labels, chat, video conferencing, and an office productivity suite.

---

## Repository Structure

```
/
├── client/                  # React 19 + TypeScript frontend (Vite)
│   └── src/
│       ├── App.tsx           # Root router and layout
│       ├── main.tsx          # App entry point
│       ├── pages/            # One component per email view/category
│       ├── components/       # Shared UI components
│       ├── chat/             # Chat messaging module
│       ├── conference/       # Video conferencing module
│       ├── docs/             # Document editing module
│       ├── notes/            # Notes module
│       ├── Office/           # Office suite hub (Docs, Sheets, Notes, PDF)
│       ├── sheets/           # Spreadsheet module
│       ├── sticker/          # Sticker module
│       └── forms/            # Forms module
├── server/
│   ├── index.ts             # Monolithic Express server (~1451 lines)
│   ├── schema.sql            # PostgreSQL schema (users, emails, labels)
│   ├── tsconfig.json
│   ├── DB_SETUP.md
│   ├── EMAIL_SETUP.md
│   └── POSTGRES_SETUP.md
├── package.json              # Root — server scripts only
└── README.md
```

---

## Tech Stack

| Layer      | Technology                                        |
|------------|---------------------------------------------------|
| Frontend   | React 19, TypeScript, Vite 7, React Router v6    |
| Backend    | Node.js, Express, TypeScript, ts-node             |
| Database   | PostgreSQL (via `pg` library)                     |
| Auth       | JWT (Bearer tokens), bcrypt (10 salt rounds)      |
| Email      | Nodemailer (SMTP), imap-simple (IMAP)             |
| Icons      | lucide-react                                      |
| Linting    | ESLint 9 (flat config), typescript-eslint         |

---

## Development Workflows

### Running the Backend

```bash
# Development (auto-reload with nodemon + ts-node)
npm run server:dev

# One-shot run
npm run server:start

# Compile TypeScript then run
npm run server:build && npm run server:serve
```

The server runs on **port 5000** by default (`PORT` env variable overrides this).

### Running the Frontend

```bash
cd client
npm install
npm run dev        # Vite dev server on http://localhost:5173
npm run build      # tsc -b && vite build
npm run lint       # ESLint check
npm run preview    # Preview production build
```

> **Note:** The frontend hardcodes the API base URL as `http://localhost:5050`. Update this if the server port changes.

### Database Setup

1. Install PostgreSQL (see `server/POSTGRES_SETUP.md`)
2. Create the database and run the schema:
   ```bash
   psql -U postgres -c "CREATE DATABASE maildb;"
   psql -U postgres -d maildb -f server/schema.sql
   ```
3. Optionally seed test data:
   ```bash
   psql -U postgres -d maildb -f server/insert-test-emails.sql
   # or
   npx ts-node server/populate-test-emails.ts
   ```

See `server/DB_SETUP.md` and `server/EMAIL_SETUP.md` for full details.

---

## Environment Variables

No `.env` files are committed. Create a `.env` file in the repo root (or export these variables):

| Variable         | Default           | Description                          |
|------------------|-------------------|--------------------------------------|
| `PORT`           | `5000`            | Express server port                  |
| `DATABASE_URL`   | *(see below)*     | Full PostgreSQL connection string     |
| `DB_HOST`        | `localhost`       | Postgres host (if no DATABASE_URL)   |
| `DB_PORT`        | `5432`            | Postgres port                        |
| `DB_NAME`        | `maildb`          | Database name                        |
| `DB_USER`        | `postgres`        | Database user                        |
| `DB_PASSWORD`    | *(none)*          | Database password                    |
| `JWT_SECRET`     | `secret`          | **Change for production!**           |
| `SMTP_HOST`      | —                 | SMTP server hostname                 |
| `SMTP_PORT`      | —                 | SMTP port                            |
| `SMTP_SECURE`    | —                 | `true`/`false` for TLS               |
| `SMTP_USER`      | —                 | SMTP username/email                  |
| `SMTP_PASS`      | —                 | SMTP password                        |
| `IMAP_HOST`      | —                 | IMAP server hostname                 |
| `IMAP_PORT`      | —                 | IMAP port                            |
| `IMAP_TLS`       | —                 | `true`/`false` for TLS               |
| `IMAP_USER`      | —                 | IMAP username                        |
| `IMAP_PASS`      | —                 | IMAP password                        |

---

## Database Schema

Three tables defined in `server/schema.sql`:

### `users`
| Column                | Type        | Notes                        |
|-----------------------|-------------|------------------------------|
| id                    | SERIAL PK   |                              |
| email                 | VARCHAR(255)| UNIQUE, NOT NULL             |
| password_hash         | VARCHAR(255)| bcrypt hashed                |
| reset_token           | VARCHAR(255)| nullable                     |
| reset_token_expires   | TIMESTAMP   | nullable                     |
| created_at            | TIMESTAMP   | default NOW()                |

### `emails`
| Column         | Type         | Notes                                    |
|----------------|--------------|------------------------------------------|
| id             | SERIAL PK    |                                          |
| user_id        | INTEGER      | FK → users(id) ON DELETE CASCADE         |
| sender         | VARCHAR(255) |                                          |
| recipient      | VARCHAR(255) |                                          |
| subject        | TEXT         |                                          |
| body           | TEXT         |                                          |
| sent_at        | TIMESTAMP    | default NOW()                            |
| is_read        | BOOLEAN      | default false                            |
| is_starred     | BOOLEAN      | default false                            |
| is_snoozed     | BOOLEAN      | default false                            |
| is_draft       | BOOLEAN      | default false                            |
| is_archived    | BOOLEAN      | default false                            |
| is_purchased   | BOOLEAN      | default false                            |
| is_scheduled   | BOOLEAN      | default false                            |
| is_important   | BOOLEAN      | default false                            |
| is_spam        | BOOLEAN      | default false                            |
| is_deleted     | BOOLEAN      | default false                            |
| is_subscription| BOOLEAN      | default false                            |
| label          | VARCHAR(255) | nullable, custom label name              |

### `labels`
| Column          | Type         | Notes                               |
|-----------------|--------------|-------------------------------------|
| id              | SERIAL PK    |                                     |
| user_id         | INTEGER      | FK → users(id) ON DELETE CASCADE    |
| name            | VARCHAR(255) | NOT NULL                            |
| color           | VARCHAR(50)  | nullable                            |
| parent_label_id | INTEGER      | FK → labels(id), nullable (nesting) |
| created_at      | TIMESTAMP    | default NOW()                       |

---

## API Endpoints

All endpoints except `/api/register`, `/api/login`, `/api/forgot-password`, and `/api/reset-password` require an `Authorization: Bearer <token>` header.

### Authentication
| Method | Path                  | Description                    |
|--------|-----------------------|--------------------------------|
| POST   | /api/register         | Register a new user            |
| POST   | /api/login            | Login, returns JWT             |
| POST   | /api/forgot-password  | Request password reset email   |
| POST   | /api/reset-password   | Complete password reset        |

### Email Reads (GET)
| Method | Path                     | Description                  |
|--------|--------------------------|------------------------------|
| GET    | /api/inbox               | Received emails              |
| GET    | /api/sent                | Sent emails                  |
| GET    | /api/drafts              | Draft emails                 |
| GET    | /api/starred             | Starred emails               |
| GET    | /api/snoozed             | Snoozed emails               |
| GET    | /api/archived            | Archived emails              |
| GET    | /api/important           | Important emails             |
| GET    | /api/spam                | Spam emails                  |
| GET    | /api/trash               | Deleted emails               |
| GET    | /api/purchased           | Purchased emails             |
| GET    | /api/scheduled           | Scheduled emails             |
| GET    | /api/subscriptions       | Subscription emails          |
| GET    | /api/allmails            | All emails for user          |
| GET    | /api/labels/:labelName   | Emails with a specific label |

### Email Mutations
| Method | Path                        | Description                  |
|--------|-----------------------------|------------------------------|
| POST   | /api/send                   | Send an email                |
| POST   | /api/emails/draft           | Create a draft               |
| PUT    | /api/emails/:id/draft       | Update a draft               |
| PUT    | /api/emails/:id/send        | Send a draft email           |
| DELETE | /api/emails/:id/draft       | Delete a draft               |
| PUT    | /api/emails/:id/star        | Toggle starred               |
| PUT    | /api/emails/:id/snooze      | Snooze/unsnooze              |
| PUT    | /api/emails/:id/archive     | Archive/unarchive            |
| PUT    | /api/emails/:id/important   | Toggle important             |
| PUT    | /api/emails/:id/spam        | Toggle spam                  |
| PUT    | /api/emails/:id/delete      | Soft-delete (is_deleted)     |
| PUT    | /api/emails/:id/purchase    | Toggle purchased             |
| PUT    | /api/emails/:id/schedule    | Toggle scheduled             |
| PUT    | /api/emails/:id/subscription| Toggle subscription          |
| PUT    | /api/emails/:id/label       | Apply a custom label         |

### Labels
| Method | Path                   | Description             |
|--------|------------------------|-------------------------|
| GET    | /api/custom-labels     | Get user's labels       |
| GET    | /api/labels            | Alias for custom-labels |
| POST   | /api/custom-labels     | Create a label          |
| DELETE | /api/custom-labels/:id | Delete a label          |

---

## Code Conventions

### Naming
- **React components / files**: PascalCase (`InboxPage.tsx`, `EmailViewer.tsx`)
- **Variables / functions**: camelCase (`fetchAllEmails`, `inboxEmails`)
- **Database columns**: snake_case (`password_hash`, `is_starred`)
- **API routes**: kebab-case (`/api/custom-labels`, `/api/reset-password`)
- **Feature folders**: lowercase or PascalCase matching the module (`chat/`, `Office/`)

### TypeScript
- Interfaces defined at the top of `server/index.ts` for all request/response shapes
- Client uses strict TypeScript (`"strict": true` in `tsconfig.app.json`)
- Server uses relaxed strict mode (`"strict": false`, but `noImplicitAny` and `strictNullChecks` are on)
- Prefer `interface` over `type` for object shapes
- All React components are functional; no class components

### Backend Patterns
- All DB queries use parameterized values (`$1`, `$2`, …) — never string interpolation in SQL
- Route handlers are `async` with `try/catch` wrapping all DB operations
- Auth is enforced via the `authenticateToken` middleware function
- The entire server is in a single file (`server/index.ts`); avoid adding more top-level files without discussion

### Frontend Patterns
- API calls use the Fetch API with `Authorization: Bearer <token>` headers
- State management: `useState` / `useEffect` (no global store library)
- Navigation: React Router v6 (`useNavigate`, `<Routes>`, `<Route>`)
- Icons: import from `lucide-react` only
- Each major view is its own page component under `client/src/pages/`
- Feature modules (chat, notes, etc.) keep their styles in a co-located `styles/` subdirectory

---

## Testing

**There are currently no tests.** The root `npm test` script is a placeholder.

When adding tests:
- Prefer **Vitest** for the client (already using Vite)
- Prefer **Jest** or **Vitest** for the server
- Place test files adjacent to source files with a `.test.ts` / `.test.tsx` suffix

---

## Known Issues / Technical Debt

- **JWT secret defaults to `'secret'`** — must set `JWT_SECRET` before any production deployment
- **Client API URL is hardcoded** to `http://localhost:5050` — needs environment variable support
- **No tests** — high priority to add before any significant feature expansion
- **No CI/CD** — no GitHub Actions workflows exist
- **No Docker** — local PostgreSQL setup required
- **Monolithic server** — `server/index.ts` is ~1450 lines; consider splitting into route files as the API grows
- Several feature modules (chat, conference, office suite) are frontend-only with no backend integration

---

## Git Workflow

- Default development branch: `master`
- Single initial commit (`3e7fa05`) — no established commit-message convention yet
- Recommended: use conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, etc.)

---

## Quick Reference: Common Tasks

| Task                            | Command                                         |
|---------------------------------|-------------------------------------------------|
| Start backend (dev)             | `npm run server:dev` (from repo root)           |
| Start frontend (dev)            | `cd client && npm run dev`                      |
| Lint frontend                   | `cd client && npm run lint`                     |
| Build frontend                  | `cd client && npm run build`                    |
| Build backend                   | `npm run server:build` (from repo root)         |
| Apply DB schema                 | `psql -U postgres -d maildb -f server/schema.sql` |
| Seed test emails                | `npx ts-node server/populate-test-emails.ts`    |
