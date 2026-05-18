FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
RUN printf 'server { listen 80; server_name _; root /usr/share/nginx/html; index index.html; gzip on; gzip_types text/plain text/css application/json application/javascript image/svg+xml; location ~* \\.(js|css|png|jpg|jpeg|svg|woff|woff2)$ { expires 1y; add_header Cache-Control "public, immutable"; try_files $uri =404; } location / { add_header Cache-Control "public, max-age=0, must-revalidate"; try_files $uri /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
