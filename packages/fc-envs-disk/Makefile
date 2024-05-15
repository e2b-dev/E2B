ENV := $(shell cat ../../.last_used_env || echo "not-set")
-include ../../.env.${ENV}

client := gcloud compute instances list --project=$(GCP_PROJECT_ID) --format='csv(name)' | grep "client"

# Set the size of the fc-envs disk
FC_ENVS_SIZE := 512

.PHONE: resize-fc-envs
resize-fc-envs:
	gcloud --project=$(GCP_PROJECT_ID) compute disks resize fc-envs --size $(FC_ENVS_SIZE) --zone "$(GCP_ZONE)"
	gcloud compute ssh $$($(client)) --project $(GCP_PROJECT_ID) -- 'sudo xfs_growfs -d /dev/sdb'