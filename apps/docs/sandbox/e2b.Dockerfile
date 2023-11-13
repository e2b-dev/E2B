FROM e2bdev/base
# FROM nikolaik/python-nodejs:python3.11-nodejs20
# RUN DEBIAN_FRONTEND=noninteractive apt-get update

RUN mkdir /code
WORKDIR /code

# Install e2b JS SDK
RUN npm init es6 -y
RUN npm i @e2b/sdk

# Install e2b Python SDK
RUN pip install e2b

WORKDIR /