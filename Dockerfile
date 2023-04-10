FROM node:lts-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_SIGN_IN_EMAIL
ARG NEXT_PUBLIC_SIGN_IN_PASSWORD
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY

ENV NEXT_TELEMETRY_DISABLED 1
ENV BUILD docker
RUN npm run build


FROM node:lts-slim AS runner
WORKDIR /app


ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000

EXPOSE 3000

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

CMD ["node", "server.js"]
