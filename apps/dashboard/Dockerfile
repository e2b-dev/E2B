FROM --platform=linux/amd64 node:lts-slim AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma/schema.prisma ./prisma/schema.prisma
RUN npm ci

COPY . .

ARG NEXT_PUBLIC_SIGN_IN_EMAIL
ARG NEXT_PUBLIC_SIGN_IN_PASSWORD
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_PROXY
ARG NEXT_PUBLIC_API_URL
ARG BUILD

ENV NEXT_PUBLIC_PROXY=$NEXT_PUBLIC_PROXY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV BUILD=$BUILD

ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build


FROM --platform=linux/amd64 node:lts-slim AS runner
WORKDIR /app


ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000

EXPOSE 3000

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

CMD ["node", "server.js"]
