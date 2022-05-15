# This stage installs modules
FROM mhart/alpine-node:16.4 as modules

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production


# This stage builds TypeScript
FROM mhart/alpine-node:16.4 as build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY scripts/build.js ./scripts/build.js
COPY tsconfig.json ./
COPY ./src ./src
RUN ./scripts/build.js


# This stage copies modules and built TypeScript
FROM mhart/alpine-node:slim-16.4

RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

WORKDIR /app

COPY --from=modules ./app ./
COPY --from=build ./app/lib ./lib

CMD ["node", "lib/index.js"]