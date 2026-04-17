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

# tsc --build resolves project references: builds shared first, then backend
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

# Use only the compiled shared dist — overwrite package.json to point to dist/
COPY --from=builder /app/shared/dist/ ./shared/dist/
RUN echo '{"name":"@biosur/shared","version":"1.0.0","main":"dist/index.js","types":"dist/index.d.ts"}' \
    > ./shared/package.json

COPY --from=builder /app/backend/dist/ ./backend/dist/

ENV NODE_ENV=production

EXPOSE 3010

CMD ["node", "backend/dist/index.js"]
