// Console log current time with date-fns
import { format } from 'date-fns'

console.log(`Current time is ${format(new Date(), 'HH:mm:ss')}`)
