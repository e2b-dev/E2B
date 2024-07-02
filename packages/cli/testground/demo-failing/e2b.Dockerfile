FROM e2bdev/base:latest

RUN npm i -g @e2b/cli
RUN npm i -g supabase
RUN curl -fsSL https://bun.sh/install | bash
