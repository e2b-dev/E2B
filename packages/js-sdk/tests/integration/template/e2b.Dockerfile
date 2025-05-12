FROM e2bdev/code-interpreter:latest

# Install stess-ng, a tool to load and stress computer systems
RUN apt update
RUN apt install -y stress-ng

# Create a basic Next.js app
RUN npx -y create-next-app@latest basic-nextjs-app --yes --ts --use-npm

# Install dependencies
RUN cd basic-nextjs-app && npm install

