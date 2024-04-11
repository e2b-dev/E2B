variable "gcp_zone" {
  type    = string
  default = "us-central1-a"
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


job "orchestrator" {
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
        memory     = 512
        memory_max = 1024
        cpu        = 512
      }

      env {
        NODE_ID            = "${node.unique.id}"
        CONSUL_TOKEN       = var.consul_token
        OTEL_TRACING_PRINT = var.otel_tracing_print
        LOGS_PROXY_ADDRESS = var.logs_proxy_address
      }

      config {
        command = "/opt/nomad/orchestrator"
        args    = ["-port", "${var.port}"]
      }
    }
  }
}
