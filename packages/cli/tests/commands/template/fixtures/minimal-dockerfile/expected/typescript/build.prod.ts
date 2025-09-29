import { Template } from 'e2b'
import { template } from './template'

async function main() {
  await Template.build(template, {
    alias: 'minimal-template',
  });
}

main().catch(console.error);
