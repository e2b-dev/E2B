import { Template } from 'e2b'
import { template } from './template'

async function main() {
  await Template.build(template, {
    alias: 'complex-python-app',
  });
}

main().catch(console.error);
