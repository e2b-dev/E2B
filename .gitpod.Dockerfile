FROM gitpod/workspace-full

# Install Hashicorp tools
RUN sudo apt-get update && sudo apt-get install -y gnupg software-properties-common curl \
  && curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add - \
  && sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main" \
  && sudo apt-get update && sudo apt-get install -y terraform packer nomad consul

# Install GitHub Act
RUN sudo brew install act

# Install GCP CLI
RUN sudo apt-get install -y apt-transport-https ca-certificates gnupg \
  && echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee -a /etc/apt/sources.list.d/google-cloud-sdk.list \
  && curl https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo apt-key --keyring /usr/share/keyrings/cloud.google.gpg add - \
  && sudo apt-get update && sudo apt-get install -y google-cloud-cli
