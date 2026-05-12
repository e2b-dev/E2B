FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    curl \
    git \
    wget \
    vim \
    ssh \
    sudo \
    gnupg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --gid 1000 node \
    && useradd --uid 1000 --gid node --shell /bin/bash --create-home node \
    && echo "node ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node

RUN npm install -g pnpm

ENV NPM_CONFIG_PREFIX=/home/node/.npm-global
ENV PNPM_HOME=/home/node/.local/share/pnpm
ENV PATH=$PATH:$NPM_CONFIG_PREFIX/bin:$PNPM_HOME
ENV NPM_CONFIG_STORE_DIR=/home/node/.local/share/pnpm/store

# This prevents a pnpm-store folder from being created in the project folder.
RUN mkdir -p /home/node/.local/share/pnpm/store \
    && chown -R node:node /home/node

USER node
