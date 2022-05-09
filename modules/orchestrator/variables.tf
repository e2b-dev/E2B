variable "cluster_tag_name" {
  description = "The tag name the Compute Instances will look for to automatically discover each other and form a cluster. TIP: If running more than one server Server cluster, each cluster should have its own unique tag name."
  type        = string
  default     = "orch"
}

variable "server_image_family" {
  type    = string
  default = "orch"
}

variable "server_cluster_name" {
  type    = string
  default = "orch-server"
}

variable "server_cluster_size" {
  type    = number
  default = 1
}

variable "server_machine_type" {
  type    = string
  default = "n1-standard-4"
}

variable "client_image_family" {
  type    = string
  default = "orch"
}

variable "client_cluster_name" {
  type    = string
  default = "orch-client"
}

variable "client_cluster_size" {
  type    = number
  default = 1
}

variable "client_machine_type" {
  type    = string
  default = "n1-standard-4"
}

variable "gcp_zone" {
  type = string
}

variable "gcp_project_id" {
  type = string
}

variable "network_name" {
  type    = string
  default = "default"
}

variable "firecracker_envs" {
  # rootfs:
  # - /mnt/fc-envs/:some_env_id/rootfs
  # snapshot:
  # - /mnt/fc-envs/:some_env_id/snap
  # - /mnt/fc-envs/:some_env_id/mem

  type = object({
    # Specifies an absolute path to a mounted persistent disk with FC env files.
    mnt_dir_path = string

    rootfs = object({
      basename = string
    })

    snap = object({
      snapfile_basename = string
      memfile_basename  = string
    })
  })

  default = {
    mnt_dir_path = "/mnt/fc-envs"

    rootfs = {
      basename = "rootfile"
    }

    snap = {
      snapfile_basename = "snap"
      memfile_basename  = "mem"
    }
  }
}
