Check if you can use config for terraform state management

1. Create and change bucket name for terraform state
2. Create DB and apply Migrations
1. Enable APIs
   - [Secret Manager API](https://console.cloud.google.com/apis/library/secretmanager.googleapis.com)
   - [Certificate Manager API](https://console.cloud.google.com/apis/library/certificatemanager.googleapis.com)
   - [Compute Engine API](https://console.cloud.google.com/apis/library/compute.googleapis.com)
   - [Artifact Registry API](https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com)
1. Buy domain
3. Create all secrets 
   - posthog (only empty secret required) - posthog-api-key
   - supabase (#TODO: rename)
   - nomad - nomad-secret-id (empty for now)
   - consul - consul-secret-id (empty for now)
   - grafana (if you want traces / logging)
   - cloudflare

1. build cluster disk image (./packages/cluster-disk-image)
1. Run build all
1. After first terraform apply -run make bootstrap-consul and nomad and paste the secrets to gcp
1. Restart client VM



# TODOs:
1. Missing trigger in db
1. If replacing server instance - you have to restart nomad service in client node
1. Add parameter for the first setup - do everything without need for ACL tokens
