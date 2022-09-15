variable "gcp_zone" {
  type = string
}

variable "image_name" {
  type = string
}

variable "api_port_name" {
  type = string
}

variable "api_port_number" {
  type = number
}

variable "nomad_address" {
  type = string
}

variable "supabase_url" {
  type = string
}

variable "supabase_key" {
  type = string
}

variable "api_admin_key" {
  type = string
}

job "orchestration-api" {
  datacenters = [var.gcp_zone]

  priority = 90

  group "api-service" {
    network {
      port "api" {
        static = var.api_port_number
      }
    }

    service {
      name = "api"
      port = var.api_port_number
    }

    task "start" {
      driver = "docker"

      resources {
        memory_max = 1024
        memory = 512
        cpu = 1000
      }

      env {
        NOMAD_ADDRESS = var.nomad_address
        SUPABASE_URL = var.supabase_url
        SUPABASE_KEY = var.supabase_key
        API_ADMIN_KEY = var.api_admin_key
      }

      config {
        network_mode = "host"
        image = var.image_name
        ports = [var.api_port_name]
        args = [
          "--port", "${var.api_port_number}",
        ]
      }
    }
  }
}
