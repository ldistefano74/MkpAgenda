# MkpAgenda

Full-stack web app for running an event makeup business: scheduling, clients, service providers, receivables, payables and costs, with a financial dashboard and reports.

It runs in production and is used daily. I designed, built and deploy it end to end as a personal project.

**Stack:** Django 5.2 · Django REST Framework · PostgreSQL · React 19 · Material UI 7 · React Query · Docker · Google Cloud Run

> The domain is Argentine, so the UI, model names and business terms are in Spanish (e.g. *evento* = event, *cliente* = client, *prestador* = service provider, *costo* = cost, *cuenta corriente* = account ledger).

---

## What it does

The business used to run on spreadsheets, WhatsApp chats and a phone calendar. MkpAgenda brings all of that into one place:

- **Event calendar**: month, week and list views (FullCalendar), with optional Google Calendar sync.
- **Events and services**: each event has a client, a type (wedding, quinceañera, guest makeup, etc.) and services assigned to providers. Suggested prices depend on both the service and the event type.
- **Account ledger**: client payments and provider payouts, allocated to events or individual services. Balances come from a single SQL view ([`SQL/cuenta_corriente.sql`](SQL/cuenta_corriente.sql)), the source of truth for lookups, the dashboard and reports.
- **Costs**: one-off and recurring costs (monthly, quarterly, yearly…), with installment plans and auto-fill from the most recent cost of each recurrence.
- **Dashboard**: upcoming events, pending receivables, pending payables and installments due soon.
- **Reports**: monthly profit and loss (income − costs − payouts) and a filterable movement detail.
- **PDF quotes**: generated from per-event-type templates by replacing tokens with event data (PyMuPDF).
- **WhatsApp reminders**: messages are built from a configurable template with tags (`{{CLIENTE}}`, `{{FECHA}}`…) and opened through a `wa.me` link.

## Architecture

```
┌──────────────────────────┐        ┌─────────────────────────────────────┐
│  React 19 + MUI 7        │  REST  │  Django 5.2 + DRF                   │
│  React Query (cache)     │ ─────► │  views     → HTTP I/O only          │
│  Generic metadata-driven │        │  services  → business logic         │
│  CRUD                    │ ◄───── │  querysets → queries                │
└──────────────────────────┘        │  dynamic serializers                │
                                    └──────────────┬──────────────────────┘
                                                   │
                                          PostgreSQL (Neon)
                                       + vw_cuenta_corriente view
```

### Notable design decisions

**Metadata-driven CRUD.** The backend exposes field definitions for each model or serializer (`/api/metadata/<entity>/`): type, input mask, validation rules, options and default values. The frontend renders forms and data grids from that metadata through two generic components, `CRUDForm` and `CRUDList`. Adding a new entity needs almost no frontend code.

**Dynamically generated serializers.** `serializer_factory.create_serializer(Model)` builds serializers at runtime for simple entities. Cases with their own rules use explicit serializers that inherit from a shared `BaseModelSerializer`.

**Layered backend.** Views only parse the request and return the response. Queries live in `API/querysets/`, and domain logic and integrations (Google Calendar, PDFs, pricing, P&L) live in `API/services/`.

**A single source of truth for balances.** Balances used to be recomputed in several places, and the results didn't always agree. I consolidated them into one SQL view that only counts confirmed events, and the whole system reads from it.

**Local validation rules.** Custom fields (`CUITField`, `DNIField`, `FacturaField`, `Precio`) validate Argentine tax IDs, including the CUIT/CUIL check digit, and the frontend applies input masks with react-imask.

**Authentication.** Google OAuth through django-allauth, with a custom adapter that only lets in a whitelist of email addresses. Sessions are cookie-based.

## Infrastructure

- **Multi-stage Docker build**: a Node stage builds the frontend, and a Python stage serves Django plus the React build (whitenoise + gunicorn).
- **Google Cloud Run**: a single container. Migrations run on startup.
- **Neon**: serverless PostgreSQL.
- **Secret Manager**: holds production secrets. Configuration is read through `python-decouple`, so no credentials live in the code.
- **Daily automated database backups** (`pg_dump`), with restore verification and failure alerts.

## Tests

149 backend tests (Django `TestCase` + DRF `APIClient`) covering the account ledger, pricing, installments, quotes, reminders, reports, validators, and the metadata and lookup endpoints.

```powershell
python manage.py test API.tests
# or
.\scripts\run_tests.ps1
```

## Running locally

Requirements: Python 3.12, Node 20 and PostgreSQL.

```bash
# Backend
python -m venv venv
venv\Scripts\activate          # Windows  (Linux/macOS: source venv/bin/activate)
pip install -r requirements.txt
cp .env.example .env           # fill in the values
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver     # http://localhost:8000

# Frontend (in another terminal)
cd frontend
npm install
npm start                      # http://localhost:3000, proxies to :8000
```

With Docker:

```bash
docker compose up --build      # reads .env.docker
```

> The PDF quote templates aren't included in this repository because they contain the business's commercial information. Add your own under `API/templates/reports/` to generate quotes.

## Project structure

```
API/
  models.py          models and custom fields
  serializers/       base, explicit and dynamically generated serializers
  views/             REST endpoints, metadata, lookups, reports
  services/          business logic and integrations
  querysets/         reusable queries
  tests/             test suite
MkpAgenda/           Django project settings
SQL/                 account ledger view
frontend/src/
  Components/        screens, forms and base components
  hooks/api/         generic CRUD and metadata hooks (React Query)
  lib/               HTTP client and CRUD utilities
```

## Author

**Luciano Distéfano** · [lucianodistefano@gmail.com](mailto:lucianodistefano@gmail.com)
