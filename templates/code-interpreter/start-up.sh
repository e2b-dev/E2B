#!/bin/bash

install -d -m 0700 /run/e2b-jupyter

function start_code_interpreter() {
	/root/.jupyter/jupyter-healthcheck.sh
	if [ $? -ne 0 ]; then
		echo "Jupyter Server failed to start, aborting."
		exit 1
	fi

	cd /root/.server/
	.venv/bin/uvicorn main:app --host 0.0.0.0 --port 49999 --workers 1 --no-access-log --no-use-colors --timeout-keep-alive 640
}

echo "Starting Code Interpreter server..."
start_code_interpreter &
MATPLOTLIBRC=/root/.config/matplotlib/.matplotlibrc jupyter server --IdentityProvider.token="" >/dev/null 2>&1
