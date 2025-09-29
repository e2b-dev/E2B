import { Template } from 'e2b'
import { template } from './template'

async function main() {
  await Template.build(template, {
    alias: 'start-cmd-dev',
    cpuCount: 2,
    memoryMB: 1024,
  });
}

main().catch(console.error);
