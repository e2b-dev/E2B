import { defaultBuildLogger, Template } from '../../packages/js-sdk/src'
import { template, alias } from './template'

await Template.build(template, {
  alias,
  onBuildLogs: defaultBuildLogger(),
})
