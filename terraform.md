Check if you can use config for terraform state management

1. Create and change bucket name for terraform state
2. Create DB and apply Migrations
3. Enable APIs
   - [Secret Manager API](https://console.cloud.google.com/apis/library/secretmanager.googleapis.com)
   - [Certificate Manager API](https://console.cloud.google.com/apis/library/certificatemanager.googleapis.com)
   - [Compute Engine API](https://console.cloud.google.com/apis/library/compute.googleapis.com)
   - [Artifact Registry API](https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com)
4. You will need domain, if you use cloudflare - you can use terraform to set DNS and get certificate
5. Create empty values in following secrets:
   - postgres (required)
   - cloudflare if you want to use cloudflare (optional)
   - nomad - nomad-secret-id (empty for now)
   - consul - consul-secret-id (empty for now)
   - posthog (if you don't want to use posthog, create) - posthog-api-key
   - grafana (if you want traces / logging)
6. build cluster disk image (./packages/cluster-disk-image)
7. Run `make apply`
8. Run `make build-and-upload-all`
9. Run `make bootstrap-consul` and `make bootstrap-nomad` and paste the secrets to GCP
10. Run `make apply`


# TODOs:
1. Missing trigger in db
1. If replacing server instance - you have to restart nomad service in client node
1. Improve variable descriptions and format in terraform
