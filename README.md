<h1 align="center">
  <font size="30">
  <b>
    E2B Infra
  </b>
  </font>
</h1>

<h1 align="center">
  Open Source Infrastructure
  
  Powering Cloud Runtime for AI Agents
</h1>

<h4 align="center">
  <a href="https://e2b.dev/docs">Docs</a> |
  <a href="https://e2b.dev">Website</a> |
  <a href="https://discord.gg/U7KEcGErtQ">Discord</a> |
  <a href="https://twitter.com/e2b_dev">Twitter</a>
</h4>

<h4 align="center">
  <a href="https://discord.gg/U7KEcGErtQ">
    <img src="https://img.shields.io/badge/chat-on%20Discord-blue" alt="Discord community server" />
  </a>
  <a href="https://twitter.com/e2b_dev">
    <img src="https://img.shields.io/twitter/follow/infisical?label=Follow" alt="e2b Twitter" />
  </a>
</h4>

<h3 align="center">
  Visit <a href="https://github.com/e2b-dev/e2b">e2b-dev/e2b</a> repo for more information about how to start using E2B right now.
</h3>


## What is E2B Infra?

E2B is a cloud runtime for AI agents. In our main repository [e2b-dev/e2b](https://github.com/e2b-dev/E2B) we are giving you SDKs and CLI to customize and manage environments and run your AI agents in the cloud.

This repository contains the infrastructure that powers the E2B platform.

## Project Structure

In this monorepo, there are several components written in Go and a Terraform configuration for the deployment.

The main components are:

1. [API server](./packages/api/)
1. [Daemon running inside instances (sandboxes)](./packages/envd/)
1. [Nomad driver for managing instances (sandboxes)](/packages/env-instance-task-driver/)
1. [Nomad driver for building environments (templates)](/packages/env-build-task-driver/)

The following diagram shows the architecture of the whole project:
![E2B infrastructure diagram](./readme-assets/architecture.jpeg)

## Deployment

The infrastructure is deployed using [Terraform](https://www.terraform.io/) and right now it is deployable on GCP only.

Setting the infrastructure up can be a little rough right now, but we plan to improve it in the future.
