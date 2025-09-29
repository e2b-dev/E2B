import { Template } from 'e2b'
import { template } from './template'

async function main() {
  await Template.build(template, {
    alias: 'custom-app',
  });
}

main().catch(console.error);
