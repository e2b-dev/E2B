job "{{ .JobName }}/{{ .CodeSnippetID }}" {
  datacenters = ["us-central1-a"]
  type = "batch"

  meta {
    # This makes sure the job always runs even though nothing has changed in the job spec file.
    # See section "Always Deploy a New Job Version" in https://storiesfromtheherd.com/nomad-tips-and-tricks-766878dfebf4
    run_uuid = "${uuidv4()}"
  }

  group "delete-env" {
    reschedule {
      attempts  = 0
      unlimited = false
    }

    restart {
      attempts = 0
      mode = "fail"
    }

    task "delete-env" {
      driver = "docker"
      config {
        image = "busybox:1"
        command = "/bin/sh"
        args = ["-c", "chmod +x local/delete.sh && local/delete.sh {{ .FCEnvsDisk }} {{ .CodeSnippetID }}"]
        volumes = [
          "{{ .FCEnvsDisk }}:{{ .FCEnvsDisk }}"
        ]
      }

      template {
        destination = "local/delete.sh"
        data = <<EOT
#!/bin/sh
FC_ENVS_DISK="$1"
CODE_SNIPPET_ID="$2"

set -euo pipefail

if [ -z "$FC_ENVS_DISK" ]; then
  echo "ERROR: Expected fc envs disk as the first argument"
  exit 1
fi

if [ -z "$CODE_SNIPPET_ID" ]; then
  echo "ERROR: Expected environment ID as the second argument"
  exit 1
fi

ENV_DIR="${FC_ENVS_DISK}/${CODE_SNIPPET_ID}"

if [ ! -d $ENV_DIR ]; then
  # Dir might not exist for bunch of reasons. For example, maybe an env build failed.
  # We can just exist, there's nothing to cleanup.
  exit
fi

rm -rf $ENV_DIR
EOT
      }
    }

  }
}
