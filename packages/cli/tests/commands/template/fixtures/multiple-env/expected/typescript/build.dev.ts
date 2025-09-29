import { Template } from 'e2b'
import { template } from './template'

async function main() {
  await Template.build(template, {
    alias: 'env-test-dev',
  });
}

main().catch(console.error);
