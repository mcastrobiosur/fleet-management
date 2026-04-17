FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY dashboard/package.json ./dashboard/

RUN npm ci --workspace=shared --workspace=dashboard

# Copy source
COPY shared/ ./shared/
COPY dashboard/ ./dashboard/
COPY tsconfig.json ./

# Build shared types then dashboard
RUN npm run build --workspace=shared 2>/dev/null || true
RUN npm run build --workspace=dashboard

# --- Runtime: serve with nginx ---
FROM nginx:alpine

COPY --from=builder /app/dashboard/dist /usr/share/nginx/html
COPY dashboard/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
