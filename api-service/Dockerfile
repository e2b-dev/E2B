# Use the official lightweight Python image.
# https://hub.docker.com/_/python
FROM python:3.10-slim

ENV PYTHONFAULTHANDLER=1 \
    PYTHONHASHSEED=random \
    PYTHONUNBUFFERED=1

WORKDIR /app

FROM base as builder

ENV PIP_DEFAULT_TIMEOUT=100 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VERSION=1.4.0

RUN pip install "poetry==$POETRY_VERSION"
RUN python -m venv /venv

COPY pyproject.toml poetry.lock ./
RUN poetry export -f requirements.txt | /venv/bin/pip install -r /dev/stdin

COPY . .
RUN poetry build && /venv/bin/pip install dist/*.whl

FROM base as final

COPY --from=builder /venv /venv
# COPY docker-entrypoint.sh wsgi.py ./
# CMD ["./docker-entrypoint.sh"]
# Run the web service on container startup. Here we use the gunicorn
# webserver, with one worker process and 8 threads.
# For environments with multiple CPU cores, increase the number of workers
# to be equal to the cores available.
# Timeout is set to 0 to disable the timeouts of the workers to allow Cloud Run to handle instance scaling.
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 main:app


# ###########

# ARG RUN_ENV

# ENV RUN_ENV=${RUN_ENV} \
#   PYTHONFAULTHANDLER=1 \
#   PYTHONUNBUFFERED=1 \
#   PYTHONHASHSEED=random \
#   PIP_NO_CACHE_DIR=off \
#   PIP_DISABLE_PIP_VERSION_CHECK=on \
#   PIP_DEFAULT_TIMEOUT=100 \
#   POETRY_VERSION=1.3.0

# RUN pip install "poetry=$POETRY_VERSION"

# # Copy only requirements to cache them in docker layer
# WORKDIR /code
# COPY poetry.lock pyproject.toml /code/

# # Project initialization:
# RUN poetry config virtualenvs.create false \
#   && poetry install $(test "$RUN_ENV" == prod && echo "--no-dev") --no-interaction --no-ansi

# # Creating folders, and files for a project:
# COPY . /code

# ###########

# # Copy local code to the container image.
# ENV APP_HOME /app
# WORKDIR $APP_HOME
# COPY . ./

# # Install production dependencies.
# RUN pip install --no-cache-dir -r requirements.txt

# Run the web service on container startup. Here we use the gunicorn
# webserver, with one worker process and 8 threads.
# For environments with multiple CPU cores, increase the number of workers
# to be equal to the cores available.
# Timeout is set to 0 to disable the timeouts of the workers to allow Cloud Run to handle instance scaling.
CMD exec gunicorn --bind :$PORT --workers 1 --threads 8 --timeout 0 main:app
