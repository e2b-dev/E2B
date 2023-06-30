#!/bin/bash

# Start playground api
cd /playground && exec node lib/server.js &

# Start python app
cd /app && OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES exec poetry run opentelemetry-instrument --service_name agent-api --exporter_otlp_endpoint 'ingest.lightstep.com:443' --traces_exporter otlp_proto_grpc --metrics_exporter otlp_proto_grpc gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 12 --timeout 120 app:app -k uvicorn.workers.UvicornWorker &

# Wait for any process to exit
wait -n

# Exit with status of process that exited first
exit $?
