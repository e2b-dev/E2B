FROM e2bdev/base

RUN mkdir /code
WORKDIR /code

# Install e2b JS SDK
RUN npm init es6 -y
RUN npm i e2b@latest

# Install e2b Python SDK
RUN pip install -U e2b

WORKDIR /