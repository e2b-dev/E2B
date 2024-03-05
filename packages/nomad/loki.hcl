variable "gcp_zone" {
  type = string
}

job "loki" {
  datacenters = [var.gcp_zone]
  type        = "service"

  priority = 75

  # TODO: Configure GCP bucket + persistence

  # TODO: Configure retention

  # TODO: Configure API endpoint for 

  group "loki" {
    count = 1

    // network {
    //   port "health" {
    //     to = var.logs_health_port_number
    //   }
    //   port "logs" {
    //     to = var.logs_port_number
    //   }
    // }

    network {
      port "health" {
        to = var.session_proxy_port_number
      }
      port "logs-api" {
        static = 3004
      }
    }

      // service {
      //   name = "loki"
      //   port = "loki_port"

      //   check {
      //     type     = "http"
      //     path     = "/health"
      //     interval = "10s"
      //     timeout  = "2s"
      //   }
      // }

    service {
      name = var.session_proxy_service_name
      port = var.session_proxy_port_name

      check {
        type     = "http"
        name     = "health"
        path     = "/health"
        interval = "20s"
        timeout  = "5s"
        port     = "status"
      }
    }


    task "loki" {
      driver = "docker"

      config {
        image = "grafana/loki:2.9.5"

        args = [
          "-config.file",
          "local/loki-config.yml",
        ]

        port_map {
          loki_port = 3100
        }
      }

      resources {
        cpu    = 500
        memory = 1024
      }

      template {
        data = <<EOF
auth_enabled: false

server:
  http_listen_port: ${var.user_logs_loki_port}

gcs_storage_config:
  bucket_name: "${var.user_logs_bucket_name}"
  client_secret: |
    {
      "type": "service_account",
      "project_id": "loki-logging",
      "private_key_id": "private_key_id",
      "private_key": "private_key",
      "client_email": "client_email",
      "client_id": "client_id",
      "auth_uri": "auth_uri",
      "token_uri": "token_uri",
      "auth_provider_x509_cert_url": "auth_provider_x509_cert_url",
      "client_x509_cert_url": "client_x509_cert_url"
    }
  client_id: "client_id"
  client_secret: "client_secret"
  token_uri: "token_uri"
  auth_provider_x509_cert_url: "auth_provider_x509_cert_url"
  client_x509_cert_url: "client_x509_cert_url"
  auth_uri: "auth_uri"
  project_id: "loki-logging"
  location: "us-central1"
  storage_class: "MULTI_REGIONAL"
  retention_policy: "30d"

EOF

        destination = "local/loki-config.yml"
      }
    }
  }
}
