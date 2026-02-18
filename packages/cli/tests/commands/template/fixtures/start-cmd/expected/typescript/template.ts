import { Template } from 'e2b'

export const template = Template()
  .fromImage('python:3.11')
  .setUser('root')
  .setWorkdir('/')
  .setWorkdir('/app')
  .runCmd('pip install --upgrade pip')
  .runCmd('pip install -r requirements.txt')
  .setEnvs({
    'PYTHONUNBUFFERED': '1',
  })
  .setUser('user')
  .setStartCmd('sudo node server.js', 'sleep 20')