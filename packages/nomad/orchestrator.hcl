variable "gcp_zone" {
  type    = string
}

variable "port" {
  type    = number
  default = 5008
}

variable "consul_token" {
  type    = string
  default = ""
}

variable "logs_proxy_address" {
  type    = string
  default = ""
}

variable "otel_tracing_print" {
  type    = string
  default = ""
}

variable "environment" {
  type    = string
  default = ""
}

variable "bucket_name" {
    type    = string
    default = ""
}

variable "orchestrator_checksum" {
  type    = string
  default = ""
}

job "orchestrator" {
  type = "system"
  datacenters = [var.gcp_zone]

  priority = 85

  group "client-orchestrator" {
    network {
      port "orchestrator" {
        static = var.port
      }
    }

    service {
      name = "orchestrator"
      port = var.port

      check {
        type         = "grpc"
        name         = "health"
        interval     = "20s"
        timeout      = "5s"
        grpc_use_tls = false
        port         = var.port
      }
    }

    task "start" {
      driver = "raw_exec"

      resources {
        memory     = 1024
        cpu        = 1000
      }

      env {
        NODE_ID            = "${node.unique.id}"
        CONSUL_TOKEN       = var.consul_token
        OTEL_TRACING_PRINT = var.otel_tracing_print
        LOGS_PROXY_ADDRESS = var.logs_proxy_address
        ENVIRONMENT        = var.environment
      }

      config {
        command = "/bin/bash"
        args    = ["-c", " chmod +x local/orchestrator && local/orchestrator --port ${var.port}"]
      }

      artifact {
        source      = "gcs::https://www.googleapis.com/storage/v1/${var.bucket_name}/orchestrator"
        options {
            checksum    = "md5:${var.orchestrator_checksum}"
        }
      }
    }
  }
}
