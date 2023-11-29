terraform {
  required_version = ">= 1.5.0, < 1.6.0"
  backend "gcs" {
    bucket = "e2b-intra-test-terraform-state"
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
      version = "2.0.0"
    }
    consul = {
      source  = "hashicorp/consul"
      version = "2.20.0"
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
data "google_secret_manager_secret_version" "cloudflare_api_token" {
  secret = "${var.prefix}cloudflare-api-token"
}

provider "cloudflare" {
  api_token = data.google_secret_manager_secret_version.cloudflare_api_token.secret_data
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

data "google_secret_manager_secret_version" "consul_acl_token" {
  secret = "${var.prefix}consul-secret-id"
}


data "google_secret_manager_secret_version" "nomad_acl_token" {
  secret = "${var.prefix}nomad-secret-id"
}

provider "nomad" {
  address   = "http://nomad.${var.domain_name}"
  secret_id = data.google_secret_manager_secret_version.nomad_acl_token.secret_data
}


provider "consul" {
  address = "http://consul.${var.domain_name}"
  token   = data.google_secret_manager_secret_version.consul_acl_token.secret_data
}

resource "google_service_account" "infra_instances_service_account" {
  account_id   = "${var.prefix}infra-instances"
  display_name = "Infra Instances Service Account"
}

resource "google_service_account_key" "google_service_key" {
  service_account_id = google_service_account.infra_instances_service_account.name
}


module "buckets" {
  source = "./packages/buckets"

  gcp_service_account_email = google_service_account.infra_instances_service_account.email
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

#module "github-tf" {
#  source = "./github-tf"
#
#  gcp_project_id = var.gcp_project_id
#
#  github_organization = var.github_organization
#  github_repository   = var.github_repository
#
#  prefix = var.prefix
#}



module "cluster" {
  source = "./packages/cluster"

  gcp_project_id = var.gcp_project_id
  gcp_region     = var.gcp_region

  server_cluster_size = var.server_cluster_size
  client_cluster_size = var.client_cluster_size

  server_machine_type = var.server_machine_type
  client_machine_type = var.client_machine_type

  logs_health_proxy_port = var.logs_health_proxy_port
  logs_proxy_port        = var.logs_proxy_port

  client_proxy_health_port     = var.client_proxy_health_port
  client_proxy_port            = var.client_proxy_port
  api_port                     = var.api_port
  google_service_account_email = google_service_account.infra_instances_service_account.email
  domain_name                  = var.domain_name

  fc_envs_disk_name           = module.fc_envs_disk.disk_name
  docker_contexts_bucket_name = module.buckets.envs_docker_context_bucket_name
  cluster_setup_bucket_name   = module.buckets.cluster_setup_bucket_name
  fc_env_pipeline_bucket_name = module.buckets.fc_env_pipeline_bucket_name

  labels = var.labels
  prefix = var.prefix
}

resource "consul_acl_policy" "agent" {
  name  = "agent"
  rules = <<-RULE
    key_prefix "" {
      policy = "deny"
    }
    RULE
}

resource "consul_acl_token_policy_attachment" "attachment" {
  token_id = "00000000-0000-0000-0000-000000000002"
  policy   = consul_acl_policy.agent.name
}

data "google_secret_manager_secret_version" "grafana_api_key" {
  secret = "${var.prefix}grafana-api-key"
}

data "google_secret_manager_secret_version" "grafana_traces_endpoint" {
  secret = "${var.prefix}grafana-traces-endpoint"
}

data "google_secret_manager_secret_version" "grafana_logs_endpoint" {
  secret = "${var.prefix}grafana-logs-endpoint"
}

data "google_secret_manager_secret_version" "grafana_metrics_endpoint" {
  secret = "${var.prefix}grafana-metrics-endpoint"
}

data "google_secret_manager_secret_version" "grafana_traces_username" {
  secret = "${var.prefix}grafana-traces-username"
}

data "google_secret_manager_secret_version" "grafana_logs_username" {
  secret = "${var.prefix}grafana-logs-username"
}

data "google_secret_manager_secret_version" "grafana_metrics_username" {
  secret = "${var.prefix}grafana-metrics-username"
}


module "telemetry" {
  source = "./packages/telemetry"

  logs_health_proxy_port = var.logs_health_proxy_port
  logs_proxy_port        = var.logs_proxy_port

  gcp_zone = var.gcp_zone

  grafana_traces_endpoint  = data.google_secret_manager_secret_version.grafana_traces_endpoint.secret_data
  grafana_logs_endpoint    = data.google_secret_manager_secret_version.grafana_logs_endpoint.secret_data
  grafana_metrics_endpoint = data.google_secret_manager_secret_version.grafana_metrics_endpoint.secret_data

  grafana_traces_username  = data.google_secret_manager_secret_version.grafana_traces_username.secret_data
  grafana_logs_username    = data.google_secret_manager_secret_version.grafana_logs_username.secret_data
  grafana_metrics_username = data.google_secret_manager_secret_version.grafana_metrics_username.secret_data

  grafana_api_key = data.google_secret_manager_secret_version.grafana_api_key.secret_data
}

module "session_proxy" {
  source = "./packages/session-proxy"

  client_cluster_size        = var.client_cluster_size
  gcp_zone                   = var.gcp_zone
  session_proxy_service_name = var.session_proxy_service_name

  session_proxy_port = var.session_proxy_port
}

module "client_proxy" {
  source = "./packages/client-proxy"

  gcp_zone                   = var.gcp_zone
  session_proxy_service_name = var.session_proxy_service_name

  client_proxy_port        = var.client_proxy_port
  client_proxy_health_port = var.client_proxy_health_port

  domain_name = var.domain_name
}

module "api" {
  source = "./packages/api"

  gcp_project_id = var.gcp_project_id
  gcp_region     = var.gcp_region
  gcp_zone       = var.gcp_zone

  logs_proxy_address            = "http://${module.cluster.logs_proxy_ip}"
  nomad_token                   = data.google_secret_manager_secret_version.nomad_acl_token.secret_data
  consul_token                  = data.google_secret_manager_secret_version.consul_acl_token.secret_data
  api_port                      = var.api_port
  environment                   = var.environment
  docker_contexts_bucket_name   = module.buckets.envs_docker_context_bucket_name
  google_service_account_email  = google_service_account.infra_instances_service_account.email
  google_service_account_secret = google_service_account_key.google_service_key.private_key

  labels = var.labels
  prefix = var.prefix
}
