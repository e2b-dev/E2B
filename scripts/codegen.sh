#!/bin/sh

set -eu

# This script is used for codegen from openapi and envd spec in a docker container
# run this script from the root of the repo

docker run -v "$(pwd):/workspace" $(docker build -q -t codegen-env . -f codegen.Dockerfile)
