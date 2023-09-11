client := orch-client-34kx

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

test-docker:
	docker build -t test.fc-driver . -f debug.Dockerfile

dev-start-nomad:
	gcloud compute ssh $(client) -- 'sudo nomad agent -config=/etc/nomad/config.hcl -dev -bind 0.0.0.0 -log-level INFO'

dev-start-consul:
	gcloud compute ssh $(client) -- 'consul agent -dev'

# This is just for development - changes to fc-driver are lost when you redeploy
# You run the parametrized command like this:
# gcloud compute ssh $(client) -- 'sudo pgrep nomad | xargs sudo kill'
dev-update-driver:
	make build
	gcloud compute ssh $(client) -- 'sudo rm -f /opt/nomad/plugins/firecracker-task-driver'
	gcloud compute scp ./packages/firecracker-task-driver/bin/firecracker-task-driver root@$(client):/opt/nomad/plugins/firecracker-task-driver
	gcloud compute ssh $(client) -- 'sudo pgrep firecracker | xargs -n1 sudo kill -9'

dev-run-session:
	gcloud compute scp ./packages/firecracker-task-driver/session.hcl root@$(client):/opt/nomad/session.hcl
	gcloud compute ssh $(client) -- 'nomad system gc && nomad job run /opt/nomad/session.hcl'

dev-session-status:
	gcloud compute ssh $(client) -- 'nomad job status session/dev'

dev-session-alloc:
	gcloud compute ssh $(client) -- 'nomad alloc status $(alloc)'