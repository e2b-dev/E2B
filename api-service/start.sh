#!/bin/bash

# Start playground api
cd /playground && node lib/server.js &
  
# Start python app
cd /app && exec poetry run gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 0 app:app &
  
# Wait for any process to exit
wait -n
  
# Exit with status of process that exited first
exit $?
