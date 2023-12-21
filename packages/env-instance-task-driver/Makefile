CURRENT_ENV := $(shell cat ../../.last_used_env || echo "not-set")
-include ../../.env.${CURRENT_ENV}

client := gcloud compute instances list --format='csv(name)' --project $(GCP_PROJECT) | grep "client"

upload:
	./upload.sh $(GCP_PROJECT)

build:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/ .

build-debug:
	CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -race -gcflags=all="-N -l" -o bin/debug/ .

# request for the pprof works in the browser but there are some problems with the requests from terminal
# You run the parametrized command like this:
# make client-ip=34.72.208.46 metric=heap interval=90 run-profiler
run-profiler:
	go tool pprof -http :9991 http://$(client-ip):6061/debug/pprof/$(metric)?seconds=$(interval)\&timeout=120

update-driver:
	make build
	make upload
	gcloud compute ssh $$($(client)) -- 'sudo rm -rf /opt/nomad/plugins/env-instance-task-driver && \
	sudo cp /mnt/disks/envs-pipeline/env-instance-task-driver /opt/nomad/plugins/env-instance-task-driver && \
	sudo chmod +x /opt/nomad/plugins/env-instance-task-driver && \
	([[ $$(pgrep firecracker) ]] && sudo kill -9 $$(pgrep firecracker)) || echo "No firecracker process found" && \
	sleep 4 && \
	sudo supervisorctl restart nomad'

update-driver-locally:
	make build-debug
	sudo rm -rf /opt/nomad/plugins/env-instance-task-driver
	sudo cp ./bin/debug/env-instance-task-driver /opt/nomad/plugins/env-instance-task-driver
	sudo chmod +x /opt/nomad/plugins/env-instance-task-driver
	([[ $$(pgrep firecracker) ]] && sudo kill -9 $$(pgrep firecracker)) || echo "No firecracker process found"
	sleep 4
	sudo supervisorctl restart nomad

build-and-upload:
	make build
	make upload
