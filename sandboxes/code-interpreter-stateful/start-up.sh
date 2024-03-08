#!/bin/bash

function start_jupyter_server() {
	response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8888/api")
	while [[ ${response} -ne 200 ]]; do
		echo "Waiting for Jupyter Server to start..."
		response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8888/api")
	done
	echo "Jupyter Server started"

	response=$(curl -s -X POST "localhost:8888/api/kernels")
	status=$(echo "${response}" | jq -r '.execution_state')
	if [[ ${status} != "starting" ]]; then
		echo "Error creating kernel: ${response} ${status}"
		exit 1
	fi
	echo "Kernel created"

	kernel=$(echo "${response}" | jq -r '.id')

	sudo mkdir -p /root/.jupyter

	sudo echo "${kernel}" | sudo tee /root/.jupyter/kernel_id >/dev/null
	echo "Jupyter Server started"
}

echo "Starting Jupyter Server..."
start_jupyter_server &
jupyter server --IdentityProvider.token=""
