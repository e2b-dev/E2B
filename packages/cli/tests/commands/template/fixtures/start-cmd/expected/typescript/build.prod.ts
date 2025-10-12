import { Template, defaultBuildLogger } from 'e2b'
import { template } from './template'

async function main() {
  await Template.build(template, {
    alias: 'start-cmd',
    cpuCount: 2,
    memoryMB: 1024,
    onBuildLogs: defaultBuildLogger(),
  });
}

main().catch(console.error);