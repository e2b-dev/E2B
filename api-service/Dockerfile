# This stage installs playground modules
FROM node:18 as playground-modules

WORKDIR /playground

COPY playground/package.json playground/yarn.lock ./
RUN yarn --production --frozen-lockfile


# This stage builds playground code
FROM node:18 as playground-build

WORKDIR /playground

COPY playground/package.json playground/yarn.lock ./
RUN yarn --frozen-lockfile

COPY playground/tsconfig.json ./
COPY playground/tsoa.json ./
COPY playground/scripts/build.js ./scripts/build.js
COPY playground/src ./src
RUN yarn build


# This stage installs cf-worker-template modules
FROM node:18 as cf-worker-modules

WORKDIR /app/cf-worker-template
COPY cf-worker-template/package.json cf-worker-template/package-lock.json ./
RUN npm ci --omit=dev


# This is the final image that also installs python deps
FROM nikolaik/python-nodejs

ENV PYTHONFAULTHANDLER=1 \
    PYTHONHASHSEED=random \
    PYTHONUNBUFFERED=1

ENV PIP_DEFAULT_TIMEOUT=100 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VERSION=1.4.0

RUN poetry config virtualenvs.in-project true

WORKDIR /app
COPY pyproject.toml poetry.lock ./
RUN --mount=type=cache,target=/home/.cache/pypoetry/cache \
    --mount=type=cache,target=/home/.cache/pypoetry/artifacts \
    poetry install --without dev --no-root --no-ansi --no-interaction

COPY . ./

WORKDIR /playground
COPY --from=playground-modules ./playground/ ./
COPY --from=playground-build ./playground/lib ./lib

WORKDIR /app/cf-worker-template
COPY --from=cf-worker-modules ./app/cf-worker-template ./

WORKDIR /app

CMD ./start.sh
