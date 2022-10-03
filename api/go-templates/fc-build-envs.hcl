job "{{ .JobName }}/{{ .CodeSnippetID }}" {
  datacenters = ["us-central1-a"]
  type = "batch"

  priority = 30

  meta {
    # This makes sure the job always runs even though nothing has changed in the job spec file.
    # See section "Always Deploy a New Job Version" in https://storiesfromtheherd.com/nomad-tips-and-tricks-766878dfebf4
    run_uuid = "${uuidv4()}"
  }

  group "build-env" {
    reschedule {
      attempts  = 0
      unlimited = false
    }

    restart {
      attempts = 0
      mode = "fail"
    }

    task "build-env" {
      resources {
        memory  = 200
        cpu   = 400
      }
      driver = "raw_exec"

      artifact {
        source = "https://storage.googleapis.com/devbook-environment-pipeline/env.tar.gz"
        destination = "local"
      }

      config {
        command = "local/env/build-env.sh"
        args = [
          "${NOMAD_META_RUN_UUID}",
          "local/env",
          "{{ escapeHCL .Dockerfile }}",
          "{{ .CodeSnippetID }}",
          "${NOMAD_ALLOC_DIR}",
          "{{ .FCEnvsDisk }}",
          "{{ .APIKey }}",
        ]
      }
    }

    task "poststop" {
      lifecycle {
        hook = "poststop"
      }

      driver = "docker"

      config {
        image = "alpine/curl:3.14"
        command = "/bin/ash"
        args = [
          "-c",
          "chmod +x local/poststop.sh && local/poststop.sh {{ .CodeSnippetID }} {{ .APIKey }}",
        ]
      }

      template {
        data = <<EOT
#!/bin/ash

CODE_SNIPPET_ID="$1"
API_KEY="$2"

set -euo pipefail

if [ -z "$CODE_SNIPPET_ID" ]; then
  echo "ERROR: Expected code snippet ID as the first argument"
  exit 1
fi

if [ -z "$API_KEY" ]; then
  echo "ERROR: Expected code snippet ID as the second argument"
  exit 1
fi

API_URL="https://ondevbook.com"
ENVS_ENDPOINT="${API_URL}/envs/${CODE_SNIPPET_ID}/state?api_key=$API_KEY"

# Main didn't finish successfully.
if [ ! -f ${NOMAD_ALLOC_DIR}/main-done ]; then
  echo "No 'main-done' file"
  curl $ENVS_ENDPOINT \
    -H "Content-Type: application/json" \
    -X PUT \
    -d "{
      \"state\": \"Failed\"
    }"

  # Print to stderr.
  >&2 echo "Main task didn't finish successfully"
  exit 2
fi

# Main finished successfully.
echo "Main finished successfully"

response=$(curl $ENVS_ENDPOINT \
  -H "Content-Type: application/json" \
  -X PUT \
  -d "{
    \"state\": \"Done\"
  }")
echo "Response: $response"
EOT
        destination = "local/poststop.sh"
      }
    }
  }
}
