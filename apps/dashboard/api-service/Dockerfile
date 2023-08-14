# This stage builds playground
FROM --platform=linux/amd64 node:lts-slim as playground

WORKDIR /playground

COPY playground/package.json playground/package-lock.json ./
RUN npm ci

COPY playground/tsconfig.json ./
COPY playground/tsoa.json ./
COPY playground/scripts/build.js ./scripts/build.js
COPY playground/src ./src
RUN npm run build


# This is the final image that also installs python deps
FROM --platform=linux/amd64 nikolaik/python-nodejs:python3.10-nodejs18-slim

ENV PYTHONFAULTHANDLER=1 \
    PYTHONHASHSEED=random \
    PYTHONUNBUFFERED=1

ENV PIP_DEFAULT_TIMEOUT=100 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

RUN poetry config virtualenvs.in-project true

WORKDIR /app
COPY pyproject.toml poetry.lock ./
RUN --mount=type=cache,target=/home/.cache/pypoetry/cache \
    --mount=type=cache,target=/home/.cache/pypoetry/artifacts \
    poetry install --no-root --no-ansi --no-interaction

RUN poetry run opentelemetry-bootstrap -a install

COPY . ./
RUN rm -rf ./playground

WORKDIR /playground
COPY --from=playground ./playground/node_modules ./node_modules
COPY --from=playground ./playground/lib ./lib

WORKDIR /app

CMD exec ./start.sh
