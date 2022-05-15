init:
	go mod vendor

build:
	CGO_ENABLED=0 GOOS=linux go build -a -o bin/ .

update-dev-driver:
	GOOS=linux go build -a -o bin/ .
	gcloud compute ssh orch-client-mdb1 -- 'sudo rm -f /opt/nomad/plugins/firecracker-task-driver'
	gcloud compute scp /workspace/orchestration-services/modules/orchestrator/firecracker-task-driver/bin/firecracker-task-driver root@orch-client-mdb1:/opt/nomad/plugins/firecracker-task-driver
	gcloud compute ssh orch-client-mdb1 -- 'sudo pgrep nomad | xargs sudo kill'
