import { Template } from 'e2b'
import { template } from './template'

await Template.build(template, {
  alias: 'minimal-template-dev',
})
