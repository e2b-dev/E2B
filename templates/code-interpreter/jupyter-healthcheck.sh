#!/bin/bash
# Custom health check for Jupyter Server
# Verifies the server is responsive via the /api/status endpoint

MAX_RETRIES=50
RETRY_INTERVAL=0.2

for i in $(seq 1 $MAX_RETRIES); do
    status_code=$(curl --unix-socket /run/e2b-jupyter/server.sock -s -o /dev/null -w "%{http_code}" "http://localhost/api/status")

    if [ "$status_code" -eq 200 ]; then
        echo "Jupyter Server is healthy"
        exit 0
    fi

    if [ $((i % 10)) -eq 0 ]; then
        echo "Waiting for Jupyter Server to become healthy... (attempt $i/$MAX_RETRIES)"
    fi
    sleep $RETRY_INTERVAL
done

echo "Jupyter Server health check failed after $MAX_RETRIES attempts"
exit 1
