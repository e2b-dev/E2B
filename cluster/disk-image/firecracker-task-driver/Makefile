init:
	go mod vendor

build:
	CGO_ENABLED=0 GOOS=linux go build -a -o bin/ .

update-dev-driver:
	CGO_ENABLED=0 GOOS=linux go build -a -o bin/ .
	gcloud compute ssh orch-client-9s49 -- 'sudo rm -f /opt/nomad/plugins/firecracker-task-driver'
	gcloud compute scp /workspace/orchestration-services/cluster/disk-image/firecracker-task-driver/bin/firecracker-task-driver root@orch-client-9s49:/opt/nomad/plugins/firecracker-task-driver
	gcloud compute ssh orch-client-9s49 -- 'sudo pgrep nomad | xargs sudo kill'

set-project-gcloud:
	gcloud config set project devbookhq

generate:
	cd driver/client && swagger generate client -f firecracker.yml -A firecracker