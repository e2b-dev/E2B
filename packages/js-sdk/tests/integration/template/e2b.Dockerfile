FROM e2bdev/code-interpreter:latest

# Create a basic Next.js app
RUN npx -y create-next-app@latest test --yes --ts --use-npm

# Install dependencies
RUN cd basic-nextjs-app && npm install

