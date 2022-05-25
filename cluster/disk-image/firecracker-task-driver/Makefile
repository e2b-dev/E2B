init:
	go mod vendor

build:
	CGO_ENABLED=0 GOOS=linux go build -a -o bin/ .

update-dev-driver:
	CGO_ENABLED=0 GOOS=linux go build -a -o bin/ .
	gcloud compute ssh orch-client-f6v2 -- 'sudo rm -f /opt/nomad/plugins/firecracker-task-driver'
	gcloud compute scp /workspace/orchestration-services/cluster/disk-image/firecracker-task-driver/bin/firecracker-task-driver root@orch-client-f6v2:/opt/nomad/plugins/firecracker-task-driver
	gcloud compute ssh orch-client-f6v2 -- 'sudo pgrep nomad | xargs sudo kill'

set-project-gcloud:
	gcloud config set project devbookhq