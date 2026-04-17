FROM node:20-alpine AS builder

WORKDIR /app

# Copy ALL workspace manifests
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/
COPY mobile/package.json ./mobile/
COPY dashboard/package.json ./dashboard/

RUN npm ci

# Copy source
COPY shared/ ./shared/
COPY mobile/ ./mobile/
COPY tsconfig.json ./

# API URL inlined at build time by Metro bundler
ARG EXPO_PUBLIC_API_BASE_URL=/api
ENV EXPO_PUBLIC_API_BASE_URL=$EXPO_PUBLIC_API_BASE_URL

RUN cd mobile && npx expo export --platform web

# --- Runtime: serve with nginx ---
FROM nginx:alpine

COPY --from=builder /app/mobile/dist /usr/share/nginx/html
COPY mobile/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
