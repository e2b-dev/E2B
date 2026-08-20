import { Template } from 'e2b'

export const template = new Template()
  .fromImage('ubuntu:latest')
  .setUser('root')
  .setWorkdir('/')
  .setUser('user')
  .setWorkdir('/home/user')