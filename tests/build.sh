#!/bin/bash

set -euo pipefail

NAME="testing-$(date +"%Y-%m-%d_%H-%M")"
CHECK_MARK="\xE2\x9C\x94\n\n"

echo "Creating a new template: ${NAME}"
e2b template build --name "${NAME}"
printf $CHECK_MARK

echo "Listing templates"
e2b template list | grep "${NAME}"
printf $CHECK_MARK

echo "Listing running sandboxes"
e2b sandbox list | grep "${NAME}"
printf $CHECK_MARK

echo "Deleting the template: ${NAME}"
e2b template delete -y
printf $CHECK_MARK
