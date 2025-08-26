import { Template } from 'e2b'

export const template = Template()
  .fromImage('node:18')
  .setEnvs({
    'NODE_ENV': 'production',
  })
  .setEnvs({
    'PORT': '3000',
  })
  .setEnvs({
    'DEBUG': 'false',
  })
  .setEnvs({
    'LOG_LEVEL': 'info',
  })
  .setEnvs({
    'API_URL': 'https://api.example.com',
  })
  .setEnvs({
    'SINGLE_VAR': 'single_value',
  })
  .setWorkdir('/app')