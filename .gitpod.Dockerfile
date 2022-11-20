FROM gitpod/workspace-full

# Install Hashicorp tools
RUN sudo apt-get update && sudo apt-get install -y gnupg software-properties-common curl \
  && curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add - \
  && sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
  && sudo apt-get update && sudo apt-get install -y terraform=1.1.9 packer=1.8.0 nomad consul

# Install GCP CLI
RUN sudo apt-get install -y apt-transport-https ca-certificates gnupg \
  && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list \
  && curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key --keyring /usr/share/keyrings/cloud.google.gpg add - \
  && sudo apt-get update && sudo apt-get install -y google-cloud-cli

# Installing go-swagger
RUN download_url=$(curl -s https://api.github.com/repos/go-swagger/go-swagger/releases/latest | \
  jq -r '.assets[] | select(.name | contains("'"$(uname | tr '[:upper:]' '[:lower:]')"'_amd64")) | .browser_download_url') \
  && sudo curl -o /usr/local/bin/swagger -L'#' "$download_url" \
  && sudo chmod +x /usr/local/bin/swagger

# Install oapi-codegen
RUN go install github.com/deepmap/oapi-codegen/cmd/oapi-codegen@latest

RUN bash -c ". .nvm/nvm.sh && nvm install 16.11.0 && nvm use 16.11.0 && nvm alias default 16.11.0"
RUN echo "nvm use default &>/dev/null" >> ~/.bashrc.d/51-nvm-fix
RUN npm i depcheck npm-check-updates -g
