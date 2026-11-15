# syntax=docker/dockerfile:1
#
# All-in-one image: static SPA (nginx) + Go API in one container.
# Built for free single-service hosts (Render free web service, Back4App, ...).
#
# Build from the repository root:
#   docker build -f deploy/free/Dockerfile -t textile-cad:allinone .

# ---------- frontend build ----------
FROM node:24-alpine AS web

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./
RUN npm run build

# ---------- backend build ----------
FROM golang:1.26-alpine AS api

WORKDIR /src

RUN apk add --no-cache git ca-certificates

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api \
    && CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/seed ./cmd/seed

# ---------- runtime ----------
FROM nginx:1.29-alpine

RUN apk add --no-cache ca-certificates tzdata

COPY deploy/free/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/free/entrypoint.sh /app/entrypoint.sh
COPY --from=web /app/dist /usr/share/nginx/html
COPY --from=api /out/api /app/api
COPY --from=api /out/seed /app/seed

RUN chmod +x /app/entrypoint.sh

ENV APP_ENV=production \
    WEB_PORT=8080 \
    API_PORT=9000 \
    AUTO_MIGRATE=true

EXPOSE 8080 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${WEB_PORT:-8080}/healthz" || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
