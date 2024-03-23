ENV := $(shell cat ../../.last_used_env || echo "not-set")
-include ../../.env.${ENV}

client := gcloud compute instances list --format='csv(name)' --project $(GCP_PROJECT_ID) | grep "client"

upload:
	./upload.sh $(GCP_PROJECT_ID)

build:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/ .

build-debug:
	CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -race -gcflags=all="-N -l" -o bin/debug/ .

# request for the pprof works in the browser but there are some problems with the requests from terminal
# You run the parametrized command like this:
# make client-ip=34.72.208.46 metric=heap interval=90 run-profiler
run-profiler:
	go tool pprof -http :9992 http://$(client-ip):6062/debug/pprof/$(metric)?seconds=$(interval)\&timeout=120

update-driver:
	make build
	make upload
	gcloud compute ssh $$($(client)) --project $(GCP_PROJECT_ID) -- 'sudo rm -rf /opt/nomad/plugins/env-build-task-driver && \
	sudo cp /mnt/disks/envs-pipeline/env-build-task-driver /opt/nomad/plugins/env-build-task-driver && \
	sudo chmod +x /opt/nomad/plugins/env-build-task-driver && \
	([[ $$(pgrep firecracker) ]] && sudo kill -9 $$(pgrep firecracker)) || echo "No firecracker process found" && \
	sleep 4 && \
	sudo supervisorctl restart nomad'

update-driver-locally:
	make build-debug
	sudo rm -rf /opt/nomad/plugins/env-build-task-driver
	sudo cp ./bin/debug/env-build-task-driver /opt/nomad/plugins/env-build-task-driver
	sudo chmod +x /opt/nomad/plugins/env-build-task-driver
	([[ $$(pgrep firecracker) ]] && sudo kill -9 $$(pgrep firecracker)) || echo "No firecracker process found"
	sleep 4
	sudo supervisorctl restart nomad

test:
	sudo go run -race -gcflags=all="-N -l" main.go -env idnrwvs3vrde6hknozc0 -build 4b24ff27-8f62-4a47-9b77-e599090cacee

build-and-upload:
	make build
	make upload
