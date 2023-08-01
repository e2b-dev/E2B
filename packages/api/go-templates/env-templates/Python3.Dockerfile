{{ .BaseDockerfile }}

ENV PIP_DEFAULT_TIMEOUT=100 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    POETRY_VERSION=1.0.5

RUN apt-get install -y python-is-python3 python3-pip python3-venv
RUN pip3 install "poetry==$POETRY_VERSION"

RUN poetry new code

WORKDIR /code
RUN rm -rf tests README.rst
RUN touch main.py

# Poetry creates a virtual env on the first run.
RUN poetry run python main.py

# Set env vars for devbook-daemon
RUN echo RUN_CMD=poetry >> /.dbkenv
# Format: RUN_ARGS=arg1 arg2 arg3
RUN echo RUN_ARGS=run python -u main.py >> /.dbkenv
RUN echo WORKDIR=/code >> /.dbkenv
# Relative to the WORKDIR env.
RUN echo ENTRYPOINT=main.py >> /.dbkenv

WORKDIR /
