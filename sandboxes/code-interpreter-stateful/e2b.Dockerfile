FROM python:3.10

RUN DEBIAN_FRONTEND=noninteractive apt-get update && apt-get install -y \
  build-essential curl git util-linux

ENV PIP_DEFAULT_TIMEOUT=100 \
  PIP_DISABLE_PIP_VERSION_CHECK=1 \
  PIP_NO_CACHE_DIR=1 \
  JUPYTER_CONFIG_PATH="/home/user/.jupyter"


WORKDIR /code

COPY ./requirements.txt requirements.txt
RUN pip install -r requirements.txt

RUN ipython kernel install --name "python3" --user
COPY ./jupyter_server_config.py /home/user/.jupyter/