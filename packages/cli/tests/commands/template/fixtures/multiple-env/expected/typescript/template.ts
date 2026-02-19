import { Template } from 'e2b'

export const template = Template()
  .fromImage('node:18')
  .setUser('root')
  .setWorkdir('/')
  .setEnvs({
    'NODE_ENV': 'production',
  })
  .setEnvs({
    'PORT': '3000',
  })
  .setEnvs({
    'DEBUG': 'false',
    'LOG_LEVEL': 'info',
    'API_URL': 'https://api.example.com',
  })
  .setEnvs({
    'SINGLE_VAR': 'single_value',
  })
  .setWorkdir('/app')
  .setUser('user')