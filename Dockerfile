FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY src/ ./src/

EXPOSE 3000

ENV PORT=3000 \
    INITIAL_SPOTS=20 \
    STORAGE_MODE=local \
    CPU_MODE=none \
    MAX_WORKERS=4

CMD ["node", "src/server.js"]
