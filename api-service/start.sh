#!/bin/bash

# Start playground api
cd /playground && exec node lib/server.js &

# Start python app
cd /app && exec poetry run gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 12 --timeout 120 app:app -k uvicorn.workers.UvicornWorker &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
