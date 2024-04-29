#!/bin/bash

ENV=$1

# Check if the ENV variable is set to "prod"
if [[ "$ENV" == pro* ]]; then
  echo "Please type *production* to manually deploy to $ENV"
  read input
  if [ "$input" == "production" ]; then
    echo "Proceeding..."
    exit 0
  else
    echo "Invalid input. Exiting."
    exit 1
  fi
else
  exit 0
fi
