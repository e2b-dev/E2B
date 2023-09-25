client := gcloud compute instances list --format='csv(name)' | grep "client"

upload:
	./upload.sh

build-debug:
	CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build -race -gcflags=all="-N -l" -o bin/debug/ .

build:
	CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o bin/ .

generate:
	cd internal/client && swagger generate client -f firecracker.yml -A firecracker

# request for the pprof works in the browser but there are some problems with the requests from terminal
# You run the parametrized command like this:
# make client-ip=34.72.208.46 metric=heap interval=90 run-profiler
run-profiler:
	go tool pprof -http :9991 http://$(client-ip):6061/debug/pprof/$(metric)?seconds=$(interval)\&timeout=120

update-build-driver:
	make build
	./upload.sh
	gcloud compute ssh $$($(client)) -- 'sudo rm -rf /opt/nomad/plugins/env-build-task-driver && \
	sudo cp /mnt/disks/envs-pipeline/env-build-task-driver /opt/nomad/plugins/env-build-task-driver && \
	sudo chmod +x /opt/nomad/plugins/env-build-task-driver && \
	supervisorctl restart nomad'

run-build-check:
	make build && \
	gcloud compute scp ./bin/env-build-task-driver root@$$($(client)):/tmp/build-task-driver
	gcloud compute ssh $$($(client)) -- 'sudo -s && chmod +x /tmp/build-task-driver'

test:
	sudo go run main.go -env fihwyog4sk9ap9lc618x -build c53d8e6a-5abc-2de4-b56d-8de67b64161d -provision "$$(cat ../api/internal/nomad/provision-env.ubuntu.sh)"

replace-local-build-driver:
	make build-debug
	sudo rm -rf /opt/nomad/plugins/env-build-task-driver
	sudo cp ./bin/debug/env-build-task-driver /opt/nomad/plugins/env-build-task-driver
	sudo chmod +x /opt/nomad/plugins/env-build-task-driver
	supervisorctl restart nomad
