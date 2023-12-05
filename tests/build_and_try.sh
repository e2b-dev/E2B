#!/bin/bash

set -euo pipefail

e2b build --name e2etesting
e2b list | grep e2etesting

RESULT=$(node test.js)
if [ "$RESULT" != "Hello World" ]; then
    echo "Test failed: $RESULT"
    exit 1
fi

e2b delete -y

if [[ $(e2b list) =~ e2etesting ]]; then
   echo "The template 'e2etesting' wasn't deleted."
fi

