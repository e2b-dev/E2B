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
   - [OS Config API](https://console.cloud.google.com/apis/library/osconfig.googleapis.com)
   - [Stackdriver Monitoring API](https://console.cloud.google.com/apis/library/monitoring.googleapis.com)
   - [Stackdriver Logging API](https://console.cloud.google.com/apis/library/logging.googleapis.com)
6. You will need domain on cloudflare
7. Run `make init`
8. build cluster disk image [here](./packages/cluster-disk-image)
9. Fill in cloudflare API key with access to your domain
10. Run `make build-and-upload-all`
11. Run `make apply-without-jobs`
12. Fill in following secrets:
    - postgres (required)
    - If you don't want to use, fill in random strings for following:
      - posthog (if you don't want to use posthog, fill in random string)
      - grafana (if you want traces / logging)
13. Run `make apply`
14. Provisioning of the certificates can take some time, you can check the status in the Google Cloud Console
