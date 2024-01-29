# Terraform deployment

Check if you can use config for terraform state management

1. Create bucket in Google Cloud
2. Create `.env.prod` from `.env.template` and fill in the values
3. Run `make switch-env ENV=prod`
4. Create DB and apply Migrations (./packages/shared) and run `make migrate`
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
11. Fill in following secrets:
    - postgres (required)
    - cloudflare
    - If you don't want to use, fill in random strings for following:
      - posthog (if you don't want to use posthog, fill in random string)
      - grafana (if you want traces / logging)
12. Run `make apply`
