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
COPY dashboard/ ./dashboard/
COPY tsconfig.json ./

# Vite handles TS compilation — skip tsc --build (noEmit+composite conflict)
RUN cd dashboard && npx vite build

# --- Runtime: serve with nginx ---
FROM nginx:alpine

COPY --from=builder /app/dashboard/dist /usr/share/nginx/html
COPY dashboard/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
