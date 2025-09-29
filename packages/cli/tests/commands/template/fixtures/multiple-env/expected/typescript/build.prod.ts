import { Template } from 'e2b'
import { template } from './template'

async function main() {
  await Template.build(template, {
    alias: 'env-test',
  });
}

main().catch(console.error);
