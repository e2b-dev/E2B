import { Template, defaultBuildLogger, handleBuildError } from 'e2b'
import { template } from './template'

async function main() {
  await Template.build(template, 'env-test', {
    onBuildLogs: defaultBuildLogger(),
  });
}

main().catch(handleBuildError);