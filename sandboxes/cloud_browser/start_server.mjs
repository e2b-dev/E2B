import puppeteer from 'puppeteer'
import { appendFile } from 'node:fs'

async function startServer() {
  const browser = await puppeteer.launch({ headless: "new" })
  appendFile('/home/user/.bashrc'
    , `export WS_ENDPOINT=${browser.wsEndpoint()}`,  (err) => {
    if (err) throw err;
    console.log('The browser WS endpoint has been saved to file!');
 })

  await browser.disconnect();
}

startServer();
