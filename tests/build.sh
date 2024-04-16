#!/bin/bash

set -euo pipefail

NAME="testing-$(date +"%Y-%m-%d_%H-%M")"

echo "Creating a new template: ${NAME}"
e2b template build --name "${NAME}"

echo "Listing templates"
e2b template list | grep "${NAME}"

echo "Deleting the template: ${NAME}"
e2b template delete -y
