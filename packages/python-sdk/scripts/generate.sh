#!/usr/bin/env bash

set -e

if ! command -v npx &>/dev/null; then
  if ! command -v npm &>/dev/null; then
    echo "npm & npx could not be found"
    echo "Install npm and try again"
    exit 1
  fi

  echo "npx could not be found"

  echo -n "Do you want to install it? (y/N) "
  read -r ANSWER

  if [ "$ANSWER" != y ]; then
    exit 1
  fi
fi

npx @openapitools/openapi-generator-cli generate --global-property apis,models,supportingFiles,modelDocs=false -i ./../../openapi.yml -g python-nextgen --library asyncio --additional-properties=generateSourceCodeOnly=true,packageName=agent_protocol_client
black .
