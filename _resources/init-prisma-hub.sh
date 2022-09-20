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
    "@prisma/client": "^4.3.1"
  },
  "devDependencies": {
    "@types/node": "^18.7.13",
    "prisma": "^4.3.1"
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

cat <<EOF > /code/prisma/seed.ts
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const categories = [
  {
    name: 'Math',
  },
  {
    name: 'Science',
  },
  {
    name: 'History',
  },
  {
    name: 'Geography',
  },
]

const users = [
  {
    name: 'Jasmine',
    email: 'jasmine@prisma.io',
    age: 24,
    country: 'Narnia',
    posts: {
      create: [
        {
          title: 'Post with title 1',
        },
        {
          title: 'Post with title 2',
        },
      ],
    },
  },
  {
    name: 'Ashkan',
    email: 'ashkan@prisma.io',
    age: 23,
    country: 'Westeros',
    posts: {
      create: [
        {
          title: 'Post with title 3',
        },
        {
          title: 'Post with title 4',
        },
      ],
    },
  }
]

async function main() {
  await prisma.category.createMany({
    data: categories,
    skipDuplicates: true,
  })

  const ps2 = users.map(u => prisma.user.upsert({
    where: { email: u.email },
    update: {},
    create: u,
  }))
  await Promise.all(ps2)
}

main()
EOF

echo 'Now you need to generate prisma typings manually'