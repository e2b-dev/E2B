client := gcloud compute instances list --format='csv(name)' | grep "client"

upload:
	./upload.sh

build:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/ .

generate:
	cd internal/client && swagger generate client -f firecracker.yml -A firecracker

# request for the pprof works in the browser but there are some problems with the requests from terminal
# You run the parametrized command like this:
# make client-ip=34.72.208.46 metric=heap interval=90 run-profiler
run-profiler:
	go tool pprof -http :9991 http://$(client-ip):6061/debug/pprof/$(metric)?seconds=$(interval)\&timeout=120

update-instance-driver:
	make build
	./upload.sh
	gcloud compute ssh $$($(client)) -- 'sudo rm -rf /opt/nomad/plugins/env-instance-task-driver && \
	sudo cp /mnt/disks/envs-pipeline/env-instance-task-driver /opt/nomad/plugins/env-instance-task-driver && \
	sudo chmod +x /opt/nomad/plugins/env-instance-task-driver && \
	pgrep firecracker | xargs -n1 sudo kill -9 && \
	supervisorctl restart nomad'
