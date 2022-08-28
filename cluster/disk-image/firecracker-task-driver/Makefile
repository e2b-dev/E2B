init:
	go mod vendor

build:
	CGO_ENABLED=0 GOOS=linux go build -a -o bin/ .

# This is just for development - changes to fc-driver are lost when you redeploy the client instance
# You run the parametrized command like this:
# make client=orch-client-6w0k update-dev-driver
update-dev-driver:
	CGO_ENABLED=0 GOOS=linux go build -a -o bin/ .
	gcloud compute ssh $(client) -- 'sudo rm -f /opt/nomad/plugins/firecracker-task-driver'
	gcloud compute scp /workspace/orchestration-services/cluster/disk-image/firecracker-task-driver/bin/firecracker-task-driver root@$(client):/opt/nomad/plugins/firecracker-task-driver
	gcloud compute ssh $(client) -- 'sudo pgrep nomad | xargs sudo kill'

set-project-gcloud:
	gcloud config set project devbookhq

generate:
	cd driver/client && swagger generate client -f firecracker.yml -A firecracker

# request for the pprof works in the browser but there are some problems with the requests from terminal
# You run the parametrized command like this:
# make client-ip=34.72.208.46 metric=heap interval=90 run-profiler
run-profiler:
	go tool pprof -http :9991 http://$(client-ip):6061/debug/pprof/$(metric)?seconds=$(interval)\&timeout=120
