import { Template } from 'e2b'

export const template = Template()
  .fromImage('node:18')
  .setWorkdir('/app')
  .copy('server.js', '.')
  .setUser('root')
  .setWorkdir('/home/user')
  .setStartCmd(
    'node server.js',
    'curl -f http://localhost:3000/health || exit 1'
  )
