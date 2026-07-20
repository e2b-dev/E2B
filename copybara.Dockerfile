FROM eclipse-temurin:21-jre

RUN apt-get update && apt-get install -y --no-install-recommends git && \
    rm -rf /var/lib/apt/lists/*

# gh serves as the git credential helper for private origins; it reads the
# token from GH_TOKEN in the environment.
ENV GH_VERSION=2.96.0
RUN ARCH=$(uname -m) && \
    case "$ARCH" in \
        x86_64) GH_ARCH="amd64" ;; \
        arm64|aarch64) GH_ARCH="arm64" ;; \
        *) echo "Unsupported architecture: $ARCH" && exit 1 ;; \
    esac && \
    curl -fsSL https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_${GH_ARCH}.tar.gz | \
    tar -xz --strip-components=2 -C /usr/local/bin gh_${GH_VERSION}_linux_${GH_ARCH}/bin/gh && \
    git config --system credential.helper '!gh auth git-credential'

ENV COPYBARA_VERSION=v20260720
ENV COPYBARA_SHA256=e94448c702addc17cfc45d4bbfc8509d458b9a25f4715e3e77207ad570e1075d
RUN curl -fsSL -o /opt/copybara.jar \
    https://github.com/google/copybara/releases/download/${COPYBARA_VERSION}/copybara_deploy.jar && \
    echo "${COPYBARA_SHA256}  /opt/copybara.jar" | sha256sum -c -

WORKDIR /workspace

ENTRYPOINT ["java", "-jar", "/opt/copybara.jar"]
