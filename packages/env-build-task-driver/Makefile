client := gcloud compute instances list --format='csv(name)' | grep "client"

upload:
	./upload.sh

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
	./upload.sh
	gcloud compute ssh $$($(client)) -- 'sudo rm -rf /opt/nomad/plugins/env-build-task-driver && \
	sudo cp /mnt/disks/envs-pipeline/env-build-task-driver /opt/nomad/plugins/env-build-task-driver && \
	sudo chmod +x /opt/nomad/plugins/env-build-task-driver && \
	sudo supervisorctl restart nomad && \
	($$(pgrep firecracker) && sudo kill -9 $$(pgrep firecracker)) || echo "No firecracker process found"'

update-driver-locally:
	make build-debug
	sudo rm -rf /opt/nomad/plugins/env-build-task-driver
	sudo cp ./bin/debug/env-build-task-driver /opt/nomad/plugins/env-build-task-driver
	sudo chmod +x /opt/nomad/plugins/env-build-task-driver
	sudo supervisorctl restart nomad
	($$(pgrep firecracker) && sudo kill -9 $$(pgrep firecracker)) || echo "No firecracker process found"

test:
	sudo go run -race -gcflags=all="-N -l" main.go -env zu6biammj4nr19vmspq5 -build 07ed806d-239d-b4cd-6189-4621769edc34