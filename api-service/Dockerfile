FROM nikolaik/python-nodejs

ENV PYTHONFAULTHANDLER=1 \
    PYTHONHASHSEED=random \
    PYTHONUNBUFFERED=1

ENV PIP_DEFAULT_TIMEOUT=100 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VERSION=1.4.0

RUN pip install "poetry==$POETRY_VERSION"
RUN poetry config virtualenvs.in-project true

WORKDIR /app

COPY pyproject.toml poetry.lock ./
RUN --mount=type=cache,target=/home/.cache/pypoetry/cache \
    --mount=type=cache,target=/home/.cache/pypoetry/artifacts \
    poetry install --without dev --no-root --no-ansi --no-interaction

# --mount requires DOCKER_BUILDKIT=1 -> didn't work locally for me (mlejva)
# RUN target=/home/.cache/pypoetry/cache \
#     target=/home/.cache/pypoetry/artifacts \
#     poetry install --without dev --no-root --no-ansi --no-interaction

COPY . ./


WORKDIR /app/cf-worker-template
RUN npm i --omit=dev

WORKDIR /app
CMD exec poetry run gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 0 app:app
