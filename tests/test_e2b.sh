#!/bin/bash

set -euo pipefail

NAME="testing-$(date +"%Y-%m-%d_%H-%M")"

echo "Creating a new template: ${NAME}"
e2b template build --name "${NAME}"

echo "Listing templates"
e2b template list | grep "${NAME}"

echo "Creating a new instance"
RESULT=$(node test.js "${NAME}")
if [ "$RESULT" != "Hello World" ]; then
    echo "Test failed: $RESULT"
    exit 1
fi

echo "Deleting the template: ${NAME}"
e2b template delete -y

echo "Checking if the template was deleted"
if [[ $(e2b template list) =~ ${NAME} ]]; then
   echo "The template '${NAME}' wasn't deleted."
fi
