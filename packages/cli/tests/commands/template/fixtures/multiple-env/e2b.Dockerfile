FROM node:18
ENV NODE_ENV=production
ENV PORT 3000
ENV DEBUG=false LOG_LEVEL=info API_URL=https://api.example.com
ENV SINGLE_VAR single_value
WORKDIR /app