terraform {
  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 5.0"
    }
  }
}

variable "gcp_project_id" {
  description = "The project to deploy the cluster in"
  type        = string
}

variable "gcp_region" {
  type    = string
}

variable "gcp_zone" {
  description = "All GCP resources will be launched in this Zone."
  type        = string
}

variable "github_organization" {
  description = "The name of the github organization"
  type        = string
}

variable "github_repository" {
  description = "The name of the repository"
  type        = string
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
  zone    = var.gcp_zone
}

data "google_secret_manager_secret_version" "github-token-google-secret"{
  secret = "github-repo-token"
}


provider "github" {
  owner = var.github_organization
  token = data.google_secret_manager_secret_version.github-token-google-secret.secret_data
}


resource "google_service_account" "github-action-service-account" {
  account_id   = "github-action-${var.gcp_project_id}-api"
  display_name = "Service account for deploying API via Github Actions"
}

resource "google_iam_workload_identity_pool" "github-actions-wip" {
  provider = google-beta
  workload_identity_pool_id = "github-actions-${var.gcp_project_id}-api-pool"
  display_name              = "GitHub Actions for ${var.github_repository} repo"
  description               = "OIDC identity pool for deploying ${var.github_repository} via GitHub Actions"
}


resource "google_iam_workload_identity_pool_provider" "gha-identity-pool-provider" {
  provider = google-beta
  workload_identity_pool_id          = google_iam_workload_identity_pool.github-actions-wip.workload_identity_pool_id
  workload_identity_pool_provider_id = "gh-provider"
  display_name                       = "GHA identity pool provider"
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }
  attribute_condition = "assertion.repository == \"${var.github_organization}/${var.github_repository}\" && assertion.ref == \"refs/heads/main\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

data "google_project" "gcp_project" {}

resource "google_service_account_iam_member" "gha-service-account-wif-tokencreator-iam-member" {
  service_account_id = google_service_account.github-action-service-account.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.gcp_project.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github-actions-wip.workload_identity_pool_id}/attribute.repository/${var.github_organization}/${var.github_repository}"
}



resource "google_project_iam_member" "service-account-roles" {
  for_each = toset([
    "roles/artifactregistry.writer",
    "roles/compute.instanceAdmin",
    "roles/compute.instanceAdmin.v1",
    "roles/containerregistry.ServiceAgent",
    "roles/iam.serviceAccountTokenCreator",
    "roles/iam.serviceAccountUser",
    "roles/iam.workloadIdentityUser",
    "roles/secretmanager.viewer",
    "roles/secretmanager.secretAccessor",
    "roles/storage.objectAdmin",
    "roles/resourcemanager.projectIamAdmin",
    "roles/editor",
  ])
  project = var.gcp_project_id
  role    = each.value
  member = "serviceAccount:${google_service_account.github-action-service-account.email}"
}

resource "github_actions_secret" "wif-token-secret" {
  repository      = var.github_repository
  secret_name     = "WORKLOAD_IDENTITY_PROVIDER"
  plaintext_value = "projects/${data.google_project.gcp_project.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github-actions-wip.workload_identity_pool_id}/providers/${google_iam_workload_identity_pool_provider.gha-identity-pool-provider.workload_identity_pool_provider_id}"

}

resource "github_actions_secret" "service-account-email-secret" {
  repository      = var.github_repository
  secret_name     = "SERVICE_ACCOUNT_EMAIL"
  plaintext_value = google_service_account.github-action-service-account.email
}

resource "github_actions_secret" "project-id-secret" {
  repository      = var.github_repository
  secret_name     = "GCE_PROJECT"
  plaintext_value = var.gcp_project_id
}
