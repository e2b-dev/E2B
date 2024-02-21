#!/bin/bash

set -euo pipefail

GCP_PROJECT_ID=$1

gsutil -h "Cache-Control:no-cache, max-age=0" cp -r "builds/*" "gs://${GCP_PROJECT_ID}-fc-versions"

rm -rf builds/*
