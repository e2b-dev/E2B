apk add curl

curl -L https://github.com/qualified/lsp-ws-proxy/releases/download/v0.9.0-rc.4/lsp-ws-proxy_linux-musl.tar.gz > lsp-ws-proxy.tar.gz
tar -zxvf lsp-ws-proxy.tar.gz
mv lsp-ws-proxy /usr/bin/
rm lsp-ws-proxy.tar.gz

npm i -g typescript-language-server typescript ts-node

cd /code

mkdir prisma

cat <<EOF > package.json
{
  "name": "code",
  "version": "1.0.0",
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  },
  "description": "",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "@prisma/client": "^4.2.1"
  },
  "devDependencies": {
    "@types/node": "^18.7.13",
    "prisma": "^4.2.1"
  }
}
EOF

npm i

cat <<EOF > /code/tsconfig.json
{
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "./",
    "esModuleInterop": true,
    "strict": true,
    "lib": [
      "esnext"
    ],
    "module": "esnext",
    "moduleResolution": "node",
    "noUncheckedIndexedAccess": true,
    "target": "esnext",
  },
  "include": [
    "**/*"
  ],
  "ts-node": {
    "transpileOnly": true,
    "esm": true
  }
}
EOF

mkdir dist
