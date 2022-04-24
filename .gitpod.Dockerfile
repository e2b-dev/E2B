FROM gitpod/workspace-full

# Install OpenAPI codegen
RUN go install github.com/deepmap/oapi-codegen/cmd/oapi-codegen@latest

# Install Terraform
RUN sudo apt-get update && sudo apt-get install -y gnupg software-properties-common curl
RUN curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
RUN sudo apt-add-repository "deb [arch=amd64] https://apt.releases.hashicorp.com $(lsb_release -cs) main"
RUN sudo apt-get update && sudo apt-get install terraform
