FROM node:18 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:18-slim
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "index.js"]