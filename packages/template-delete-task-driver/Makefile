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
	gcloud compute ssh $$($(client)) --project $(GCP_PROJECT_ID) --zone $(GCP_ZONE) -- 'sudo rm -rf /opt/nomad/plugins/template-delete-task-driver && \
	sudo cp /mnt/disks/envs-pipeline/template-delete-task-driver /opt/nomad/plugins/template-delete-task-driver && \
	sudo chmod +x /opt/nomad/plugins/template-delete-task-driver && \
	([[ $$(pgrep firecracker) ]] && sudo kill -9 $$(pgrep firecracker)) || echo "No firecracker process found" && \
	sleep 4 && \
	sudo supervisorctl restart nomad'

update-driver-locally:
	make build-debug
	sudo rm -rf /opt/nomad/plugins/template-delete-task-driver
	sudo cp ./bin/debug/template-delete-task-driver /opt/nomad/plugins/template-delete-task-driver
	sudo chmod +x /opt/nomad/plugins/template-delete-task-driver
	([[ $$(pgrep firecracker) ]] && sudo kill -9 $$(pgrep firecracker)) || echo "No firecracker process found"
	sleep 4
	sudo supervisorctl restart nomad

build-and-upload:
	make build
	make upload
