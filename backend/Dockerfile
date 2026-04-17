FROM node:20-alpine AS builder

WORKDIR /app

# Copy ALL workspace manifests — npm workspaces needs every one present to resolve the lockfile
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY mobile/package.json ./mobile/
COPY dashboard/package.json ./dashboard/

RUN npm ci

# Copy source
COPY shared/ ./shared/
COPY backend/ ./backend/
COPY tsconfig.json ./

RUN npm run build --workspace=backend

# --- Runtime ---
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY mobile/package.json ./mobile/
COPY dashboard/package.json ./dashboard/

RUN npm ci --omit=dev

COPY --from=builder /app/shared/ ./shared/
COPY --from=builder /app/backend/dist/ ./backend/dist/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "backend/dist/index.js"]
