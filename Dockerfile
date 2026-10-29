FROM node:20-alpine

WORKDIR /app/backend

COPY backend/package*.json ./
RUN npm install --omit=dev

COPY backend/ ./
COPY frontend/ /app/frontend/
COPY *.sql /app/

EXPOSE 3000

CMD ["npm", "start"]
