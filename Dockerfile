FROM node:lts-slim AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci


# FROM node:lts-slim AS builder
# WORKDIR /app
# COPY --from=deps /app/node_modules ./node_modules

COPY . .

ENV NEXT_TELEMETRY_DISABLED 1
ENV BUILD docker
RUN npm run build


# FROM node:lts-slim AS runner
# WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000

EXPOSE 3000

# COPY --from=builder /app/.next ./.next
# COPY --from=deps /app/node_modules ./node_modules

# TODO: Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing

CMD ["npm", "run", "start:next"]

# CMD ["npx", "next", "start"]
