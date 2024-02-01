terraform {
  required_version = ">= 1.5.0, < 1.6.0"
  backend "gcs" {
    prefix = "terraform/orchestration/state"
  }
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "3.0.2"
    }
    google = {
      source  = "hashicorp/google"
      version = "5.6.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "5.6.0"
    }
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "4.19.0"
    }
    nomad = {
      source  = "hashicorp/nomad"
      version = "2.1.0"
    }
    consul = {
      source  = "hashicorp/consul"
      version = "2.20.0"
    }
    github = {
      source  = "integrations/github"
      version = "5.42.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "3.5.1"
    }
  }
}

data "google_client_config" "default" {}

provider "docker" {
  registry_auth {
    address  = "${var.gcp_region}-docker.pkg.dev"
    username = "oauth2accesstoken"
    password = data.google_client_config.default.access_token
  }
}

provider "google-beta" {
  project = var.gcp_project_id
  region  = var.gcp_region
  zone    = var.gcp_zone
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
  zone    = var.gcp_zone
}


module "init" {
  source = "./packages/init"

  labels = var.labels
  prefix = var.prefix
}

module "buckets" {
  source = "./packages/buckets"

  gcp_service_account_email = module.init.service_account_email
  gcp_project_id            = var.gcp_project_id
  gcp_region                = var.gcp_region

  labels = var.labels
}

module "fc_envs_disk" {
  source = "./packages/fc-envs-disk"

  gcp_zone          = var.gcp_zone
  fc_envs_disk_size = var.fc_envs_disk_size

  labels = var.labels
  prefix = var.prefix
}

module "github_tf" {
  source = "./github-tf"

  gcp_project_id = var.gcp_project_id
  gcp_region     = var.gcp_region
  gcp_zone       = var.gcp_zone

  github_organization = var.github_organization
  github_repository   = var.github_repository

  domain_name            = var.domain_name
  terraform_state_bucket = var.terraform_state_bucket

  prefix = var.prefix
}

module "cluster" {
  source = "./packages/cluster"

  gcp_project_id             = var.gcp_project_id
  gcp_region                 = var.gcp_region
  google_service_account_key = module.init.google_service_account_key

  server_cluster_size = var.server_cluster_size
  client_cluster_size = var.client_cluster_size

  server_machine_type = var.server_machine_type
  client_machine_type = var.client_machine_type

  logs_health_proxy_port = var.logs_health_proxy_port
  logs_proxy_port        = var.logs_proxy_port

  client_proxy_health_port     = var.client_proxy_health_port
  client_proxy_port            = var.client_proxy_port
  api_port                     = var.api_port
  google_service_account_email = module.init.service_account_email
  domain_name                  = var.domain_name

  fc_envs_disk_name           = module.fc_envs_disk.disk_name
  docker_contexts_bucket_name = module.buckets.envs_docker_context_bucket_name
  cluster_setup_bucket_name   = module.buckets.cluster_setup_bucket_name
  fc_env_pipeline_bucket_name = module.buckets.fc_env_pipeline_bucket_name
  fc_kernels_bucket_name      = module.buckets.fc_kernels_bucket_name

  consul_acl_token_secret = module.init.consul_acl_token_secret
  nomad_acl_token_secret  = module.init.nomad_acl_token_secret

  labels = var.labels
  prefix = var.prefix
}

module "api" {
  source = "./packages/api"

  gcp_project_id = var.gcp_project_id
  gcp_region     = var.gcp_region

  google_service_account_email  = module.init.service_account_email
  orchestration_repository_name = module.init.orchestration_repository_name

  labels = var.labels
  prefix = var.prefix
}

module "nomad" {
  source = "./packages/nomad"

  gcp_project_id = var.gcp_project_id
  gcp_region     = var.gcp_region
  gcp_zone       = var.gcp_zone

  consul_acl_token_secret = module.init.consul_acl_token_secret
  nomad_acl_token_secret  = module.init.nomad_acl_token_secret

  # API
  logs_proxy_address                        = "http://${module.cluster.logs_proxy_ip}"
  api_port                                  = var.api_port
  environment                               = var.environment
  docker_contexts_bucket_name               = module.buckets.envs_docker_context_bucket_name
  google_service_account_key                = module.init.google_service_account_key
  api_docker_image_digest                   = module.api.api_docker_image_digest
  api_secret                                = module.api.api_secret
  custom_envs_repository_name               = module.api.custom_envs_repository_name
  postgres_connection_string_secret_name    = module.api.postgres_connection_string_secret_name
  posthog_api_key_secret_name               = module.api.posthog_api_key_secret_name
  analytics_collector_host_secret_name      = module.init.analytics_collector_host_secret_name
  analytics_collector_api_token_secret_name = module.init.analytics_collector_api_token_secret_name

  # Proxies
  client_cluster_size = var.client_cluster_size

  session_proxy_service_name = var.session_proxy_service_name
  session_proxy_port         = var.session_proxy_port

  client_proxy_port        = var.client_proxy_port
  client_proxy_health_port = var.client_proxy_health_port

  domain_name = var.domain_name

  # Telemetry
  logs_health_proxy_port = var.logs_health_proxy_port
  logs_proxy_port        = var.logs_proxy_port

  grafana_api_key_secret_name          = module.init.grafana_api_key_secret_name
  grafana_logs_endpoint_secret_name    = module.init.grafana_logs_endpoint_secret_name
  grafana_logs_username_secret_name    = module.init.grafana_logs_username_secret_name
  grafana_metrics_endpoint_secret_name = module.init.grafana_metrics_endpoint_secret_name
  grafana_metrics_username_secret_name = module.init.grafana_metrics_username_secret_name
  grafana_traces_endpoint_secret_name  = module.init.grafana_traces_endpoint_secret_name
  grafana_traces_username_secret_name  = module.init.grafana_traces_username_secret_name
}
