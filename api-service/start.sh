#!/bin/bash

# Start playground api
cd /playground && node lib/server.js &
  
# Start python app
# TODO: Start the server on the $PORT port instead of the fixed port.
cd /app && exec poetry run gunicorn --bind 0.0.0.0:8080 --workers 1 --threads 8 --timeout 0 app:app -k uvicorn.workers.UvicornWorker &
  
# Wait for any process to exit
wait -n
  
# Exit with status of process that exited first
exit $?
