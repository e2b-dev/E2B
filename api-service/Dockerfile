FROM python:3.10

ENV PYTHONFAULTHANDLER=1 \
    PYTHONHASHSEED=random \
    PYTHONUNBUFFERED=1

ENV PIP_DEFAULT_TIMEOUT=100 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VERSION=1.4.0

ENV PIPENV_VENV_IN_PROJECT 1

RUN pip install "poetry==$POETRY_VERSION"
# RUN poetry config virtualenvs.path /venv
RUN poetry config virtualenvs.in-project true

WORKDIR /app

COPY pyproject.toml poetry.lock ./
RUN poetry install
COPY . ./


ENTRYPOINT ["poetry", "run", "gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1" ,"--threads", "8", "--timeout", "0", "app:app"]
