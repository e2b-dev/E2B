variable "gcp_zone" {
  type    = string
  default = "us-central1-a"
}

variable "port" {
  type    = number
  default = 5008
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
        type     = "http"
        name     = "health"
        path     = "/health"
        interval = "20s"
        timeout  = "5s"
        port     = var.port
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
        NODE_ID = "${node.unique.id}"
      }

      config {
        command = "/usr/bin/bash"
        args = [
          "-l",
          "-c",
          "cp /mnt/disks/envs-pipeline/orchestrator /orchestrator && chmod +x /orchestrator && sudo NODE_ID=${node.unique.id} /orchestrator --port ${var.port}",
        ]
      }
    }
  }
}
