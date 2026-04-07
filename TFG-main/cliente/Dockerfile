### Stage 1 — Build the Quasar SPA ###
FROM node:20-alpine AS builder

WORKDIR /app

# Install Quasar CLI globally
RUN npm install -g @quasar/cli

COPY package*.json ./
RUN npm install

COPY . .

# VITE_API_URL is injected at build time via --build-arg in docker-compose
ARG VITE_API_URL=http://localhost:9001
ENV VITE_API_URL=$VITE_API_URL

RUN quasar build

### Stage 2 — Serve with NGINX ###
FROM nginx:alpine

# Remove default NGINX config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom NGINX config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built SPA from stage 1
COPY --from=builder /app/dist/spa /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
