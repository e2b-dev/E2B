# Terraform deployment

Check if you can use config for terraform state management

1. Create `.env` from `.env.template` and fill in the values
2. Create and change bucket name for terraform stat
3. Change terraform backend in `main.tf` to use the bucket
4. Create DB and apply Migrations
5. Enable APIs
   - [Secret Manager API](https://console.cloud.google.com/apis/library/secretmanager.googleapis.com)
   - [Certificate Manager API](https://console.cloud.google.com/apis/library/certificatemanager.googleapis.com)
   - [Compute Engine API](https://console.cloud.google.com/apis/library/compute.googleapis.com)
   - [Artifact Registry API](https://console.cloud.google.com/apis/library/artifactregistry.googleapis.com)
6. You will need domain, if you use cloudflare - you can use terraform to set DNS and get certificate
7. Run `make init`
8. build cluster disk image (./packages/cluster-disk-image)
9. Run `make build-and-upload-all`
10. Run `make apply-without-jobs`
11. Run `make bootstrap-consul` and `make bootstrap-nomad` and paste the secrets to GCP
12. Fill in following secrets:
    - postgres (required)
    - cloudflare
    - If you don't want to use, fill in random strings for following:
      - posthog (if you don't want to use posthog, fill in random string)
      - grafana (if you want traces / logging)
13. Run `make apply`

## TODOs

- Missing trigger in db
- If replacing server instance - you have to restart nomad service in client node
- Improve variable descriptions and format in terraform
