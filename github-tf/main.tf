terraform {
  required_providers {
    github = {
      source  = "integrations/github"
      version = "5.42.0"
    }
  }
}


resource "google_secret_manager_secret" "github_token" {
  secret_id = "${var.prefix}github-repo-token"

  replication {
    auto {}
  }
}

data "google_secret_manager_secret_version" "github_token" {
  secret = google_secret_manager_secret.github_token.name
}


provider "github" {
  owner = var.github_organization
  token = data.google_secret_manager_secret_version.github_token.secret_data
}


resource "google_service_account" "github_action_service_account" {
  account_id   = "${var.prefix}github-actions"
  display_name = "Service account for deploying API via Github Actions"
}


resource "random_string" "action_wip_random" {
  length  = 4
  special = false
  lower   = true
  upper   = false
  numeric = true
}

resource "google_iam_workload_identity_pool" "github_actions_wip" {
  workload_identity_pool_id = "${var.prefix}github-actions-${var.gcp_project_id}-api-${random_string.action_wip_random.result}"
  display_name              = "GitHub Actions for ${var.github_repository} repo"
  description               = "OIDC identity pool for deploying ${var.github_repository} via GitHub Actions"
}


resource "google_iam_workload_identity_pool_provider" "gha_identity_pool_provider" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github_actions_wip.workload_identity_pool_id
  workload_identity_pool_provider_id = "${var.prefix}gh-provider"
  display_name                       = "E2B GHA identity pool provider"
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

resource "google_service_account_iam_member" "gha_service_account_wif_tokencreator_iam_member" {
  service_account_id = google_service_account.github_action_service_account.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/projects/${data.google_project.gcp_project.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github_actions_wip.workload_identity_pool_id}/attribute.repository/${var.github_organization}/${var.github_repository}"
}

resource "google_project_iam_member" "service_account_roles" {
  for_each = toset([
    "roles/artifactregistry.admin",
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
  member  = "serviceAccount:${google_service_account.github_action_service_account.email}"
}

resource "github_actions_secret" "wif_token_secret" {
  repository      = var.github_repository
  secret_name     = "E2B_WORKLOAD_IDENTITY_PROVIDER"
  plaintext_value = "projects/${data.google_project.gcp_project.number}/locations/global/workloadIdentityPools/${google_iam_workload_identity_pool.github_actions_wip.workload_identity_pool_id}/providers/${google_iam_workload_identity_pool_provider.gha_identity_pool_provider.workload_identity_pool_provider_id}"

}

resource "github_actions_secret" "service_account_email_secret" {
  repository      = var.github_repository
  secret_name     = "E2B_SERVICE_ACCOUNT_EMAIL"
  plaintext_value = google_service_account.github_action_service_account.email
}

resource "github_actions_secret" "project_id_secret" {
  repository      = var.github_repository
  secret_name     = "E2B_GCP_PROJECT_ID"
  plaintext_value = var.gcp_project_id
}

resource "github_actions_secret" "gcp_region" {
  repository      = var.github_repository
  secret_name     = "E2B_GCP_REGION"
  plaintext_value = var.gcp_region
}

resource "github_actions_secret" "gcp_zone" {
  repository      = var.github_repository
  secret_name     = "E2B_GCP_ZONE"
  plaintext_value = var.gcp_zone
}

resource "github_actions_secret" "terraform_prefix" {
  repository      = var.github_repository
  secret_name     = "E2B_TERRAFORM_PREFIX"
  plaintext_value = var.prefix
}

resource "github_actions_secret" "terraform_state_bucket" {
  repository      = var.github_repository
  secret_name     = "E2B_TERRAFORM_STATE_BUCKET"
  plaintext_value = var.terraform_state_bucket
}

resource "github_actions_secret" "domain_name" {
  repository      = var.github_repository
  secret_name     = "E2B_DOMAIN_NAME"
  plaintext_value = var.domain_name
}
