#!/bin/bash

set -euo pipefail

NAME="testing-$(date +"%Y-%m-%d_%H-%M")"

echo "Creating a new template: ${NAME}"
e2b build --name "${NAME}"

echo "Listing templates"
e2b list | grep "${NAME}"

echo "Creating a new instance"
RESULT=$(node test.js)
if [ "$RESULT" != "Hello World" ]; then
    echo "Test failed: $RESULT"
    exit 1
fi

echo "Deleting the template: ${NAME}"
e2b delete -y

echo "Checking if the template was deleted"
if [[ $(e2b list) =~ ${NAME} ]]; then
   echo "The template '${NAME}' wasn't deleted."
fi
