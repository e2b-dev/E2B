import { Template } from 'e2b'

export const template = Template()
  .fromImage('alpine:latest')
  .copy('package.json', '.')
  .copy('src/index.js', '.')
  .copy('config.json', '.')