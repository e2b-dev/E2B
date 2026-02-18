import { Template } from 'e2b'

export const template = Template()
  .fromImage('ubuntu:latest')
  .setUser('root')
  .setWorkdir('/')
  .setUser('user')
  .setWorkdir('/home/user')