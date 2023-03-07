import { PrismaClient } from '@prisma/client'
export * from '@prisma/client'

let prisma: PrismaClient

//check if we are running in production mode
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient()
} else {
  //check if there is already a connection to the database
  if (!(global as any).prisma) {
    (global as any).prisma = new PrismaClient()
  }
  prisma = (global as any).prisma
}

export { prisma }
