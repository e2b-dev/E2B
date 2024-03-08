FROM python:3.10

RUN DEBIAN_FRONTEND=noninteractive apt-get update && apt-get install -y --no-install-recommends \
  build-essential curl git util-linux jq screen

ENV PIP_DEFAULT_TIMEOUT=100 \
  PIP_DISABLE_PIP_VERSION_CHECK=1 \
  PIP_NO_CACHE_DIR=1 \
  JUPYTER_CONFIG_PATH="/home/user/.jupyter"


COPY ./requirements.txt requirements.txt
RUN pip install --no-cache-dir -r requirements.txt && ipython kernel install --name "python3" --user
COPY ./jupyter_server_config.py /home/user/.jupyter/
COPY ./start-up.sh /home/user/.jupyter/
RUN chmod +x /home/user/.jupyter/start-up.sh