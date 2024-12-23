FROM e2bdev/code-interpreter:latest

# Clone the Next.js app repository
RUN git clone https://github.com/ezesundayeze/basic-nextjs-app

# Install dependencies
RUN cd basic-nextjs-app && npm install

