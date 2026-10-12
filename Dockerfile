# ── Stage 1: Build del frontend ──────────────────────────────
FROM node:20-slim AS frontend-build

WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ .
RUN REACT_APP_API_URL=/api npm run build

# ── Stage 2: App Django ──────────────────────────────────────
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

# tzdata para la timezone de Django (psycopg2-binary ya incluye libpq)
RUN DEBIAN_FRONTEND=noninteractive apt-get update && apt-get install -y --no-install-recommends tzdata && rm -rf /var/lib/apt/lists/*

# Instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar solo lo necesario para Django
COPY manage.py .
COPY MkpAgenda/ ./MkpAgenda/
COPY API/ ./API/

# Copiar el build del frontend desde la primera etapa
COPY --from=frontend-build /frontend/build /app/frontend/build

# Collectstatic necesita SECRET_KEY — se pasa un dummy porque solo genera archivos
RUN SECRET_KEY=dummy-for-collectstatic \
    DATABASE_URL=postgresql://x:x@localhost/x \
    python manage.py collectstatic --noinput

EXPOSE 8080

CMD ["sh", "-c", "python manage.py migrate --noinput && gunicorn MkpAgenda.wsgi:application --bind 0.0.0.0:8080 --workers 2 --threads 2"]