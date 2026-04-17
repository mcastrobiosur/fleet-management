FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

# Install all workspace deps
RUN npm ci --workspace=shared --workspace=backend

# Copy source
COPY shared/ ./shared/
COPY backend/ ./backend/
COPY tsconfig.json ./

# Build shared then backend
RUN npm run build --workspace=shared 2>/dev/null || true
RUN npm run build --workspace=backend

# --- Runtime ---
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

RUN npm ci --workspace=shared --workspace=backend --omit=dev

COPY --from=builder /app/shared/ ./shared/
COPY --from=builder /app/backend/dist/ ./backend/dist/

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "backend/dist/index.js"]
