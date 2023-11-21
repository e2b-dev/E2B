FROM ghcr.io/puppeteer/puppeteer:latest

USER root
WORKDIR /home/user/
COPY package.json package-lock.json .puppeteerrc.cjs start_server.mjs /home/user/
RUN npm -y ci

COPY . /home/user/
RUN touch /home/user/.bashrc