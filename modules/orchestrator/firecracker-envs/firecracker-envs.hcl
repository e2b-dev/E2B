variable "gcp_zone" {
  type = string
}
variable "out_dir" {
  type = string
}
variable rootfile_basename {
  type = string
}
variable snapfile_basename {
  type = string
}
variable memfile_basename {
  type = string
}

job "firecracker-envs" {
  datacenters = [var.gcp_zone]
  type = "batch"

  parameterized {
    meta_required = ["CODE_SNIPPET_ID", "DOCKERFILE"]
  }

  group "fc-env" {
    task ""
    task "make-rootfs" {
      env {
        OUTDIR = var.outdir
      }

      driver = "exec"

      artifact {
        source = ""
        destination = "/local"
      }
    }

    task "make-snap" {
      driver = "exec"

      env {
        OUTDIR = var.outdir
        ROOTFILE_BASENAME = var.rootfile_basename
        SNAPFILE_BASENAME = var.snapfile_basename
        MEMFILE_BASENAME = var.memfile_basename
      }

      artifact {
        source = ""
        destination = "/usr/local/bin/mkfcenv"
      }

      config {
        command = "mkfcenv"
        args = [NOMAD_META_CODE_SNIPPET_ID, NOMAD_META_DOCKERFILE]
      }
    }
  }

  #parameterized {
  #  # TODO
  #  payload = "required"
  #  meta_required = [""]
  #}

  #group "env-snap" {
  #  reschedule {
  #    attempts  = 0
  #    unlimited = false
  #  }

  #  restart {
  #    attempts = 0
  #    mode = "fail"
  #  }

  #  task "rootfs" {
  #    driver =
  #  }

  #  task "start-fc" {
  #  }

  #  task "snap-fc" {
  #  }
  #}
}
