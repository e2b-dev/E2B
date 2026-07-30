# Sidecar template for the SDK network tests, built as `httpbin`.
#
# Firewall transforms are applied by the egress proxy on the way *out* of a
# sandbox, so asserting them end-to-end needs a request that leaves for a
# publicly reachable host which echoes back what it received. A sandbox started
# from this template is that host, which keeps the tests off any externally
# hosted service.
#
# go-httpbin is the maintained Go port of the original httpbin, shipped as a
# single static binary.
FROM debian:bookworm-slim

ENV GO_HTTPBIN_VERSION=2.25.0

RUN DEBIAN_FRONTEND=noninteractive apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates curl && \
  rm -rf /var/lib/apt/lists/*

RUN set -eux; \
  case "$(dpkg --print-architecture)" in \
    amd64) arch='amd64'; sha256='8ba077dbc2fd86dcd4acde8b17ca7d22763c3bff1e6117fc975a3f66cf8ebcb2';; \
    arm64) arch='arm64'; sha256='3becba58a8484b57885b3b99231618f82dfd29acbb5d2c021bd61100d8d3363f';; \
    *) echo "unsupported architecture"; exit 1;; \
  esac; \
  archive="go-httpbin-linux-${arch}.tar.gz"; \
  curl -fsSLO "https://github.com/mccutchen/go-httpbin/releases/download/v${GO_HTTPBIN_VERSION}/${archive}"; \
  echo "${sha256}  ${archive}" | sha256sum -c -; \
  tar -xzf "${archive}" -C /usr/local/bin go-httpbin; \
  rm "${archive}"

# The server itself is smoke-tested by the template's ready command, which has
# to exit 0 before the build finishes — see .github/workflows/templates.yml.
