import { Session } from '@e2b/sdk'

const logger = {
  debug: console.debug, // log debug messages, in default logger this is noop
  info: console.info, // log info messages, in default logger this is noop
  // don't forget to also specify warn & error handlers, otherwise they won't be logged when overriding the logger
  warn: console.warn,
  error: console.error,
}

const session = await Session.create({
  id: 'Nodejs',
  apiKey: process.env.E2B_API_KEY,
  logger,
})
