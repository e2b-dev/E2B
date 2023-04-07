FROM node:18

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

COPY . .

EXPOSE 3000

ENV PORT 3000

CMD ["npx", "next", "dev"]
