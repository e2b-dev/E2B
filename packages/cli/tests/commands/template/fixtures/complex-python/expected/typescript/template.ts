import { Template } from 'e2b'

export const template = Template()
  .fromImage('python:3.11-slim')
  .setUser('root')
  .setWorkdir('/')
  .runCmd('apt-get update && apt-get install -y gcc g++ make libpq-dev && rm -rf /var/lib/apt/lists/*')
  .setEnvs({
    'PYTHONDONTWRITEBYTECODE': '1',
    'PYTHONUNBUFFERED': '1',
  })
  .runCmd('useradd -m -u 1000 appuser')
  .setWorkdir('/app')
  .copy('requirements.txt', '.')
  .runCmd('pip install --upgrade pip && pip install -r requirements.txt')
  .copy('app.py', '.')
  .setUser('appuser')
  .setStartCmd('sudo gunicorn --bind 0.0.0.0:8000 app:application', 'sleep 20')
