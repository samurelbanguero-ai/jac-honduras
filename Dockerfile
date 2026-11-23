# Imagen de producción (Render). Para desarrollo local usa docker-compose,
# que construye backend/Dockerfile.
FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY backend/ ./
COPY frontend/ /app/frontend/
# Solo el esquema; los datos de demostración quedan fuera de la imagen.
COPY database.sql database_migracion_*.sql /app/

# Carpeta de archivos subidos con permisos para el usuario sin privilegios
RUN mkdir -p uploads/privado && chown -R node:node uploads
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/api/health" || exit 1

CMD ["node", "index.js"]
