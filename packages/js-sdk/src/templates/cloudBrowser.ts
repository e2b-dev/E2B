import { DownloadFileFormat, SandboxOpts } from "../sandbox"
import { BaseTemplate } from "./baseTemplate"

const CloudBrowserTemplateId = "CloudBrowser"

export class CloudBrowser extends BaseTemplate {
  constructor(opts: Omit<SandboxOpts, "id">) {
    super({ id: CloudBrowserTemplateId, ...opts })
  }

  static override async create(opts?: Omit<SandboxOpts, "id">) {
    return await new CloudBrowser({ ...opts })._create(opts)
  }

  async goTo(url: string, opts?: { timeout?: number }) {
    await this.runPuppeteerCode(`await page.goto("${url}")`, opts)
  }

  async getContent(selector?: string, opts?: { timeout?: number }) {
    let code = selector ? `const element = await page.$('${selector}');` : ""
    code += `
            const content = await ${selector ? 'element' : 'page'}.content();console.log(content)`
    return this.runPuppeteerCode(code, opts)
  }

  async getElement(selector: string, opts?: { timeout?: number }) {
    const code = `
        const element = await page.$('${selector}');
        console.log(element)
      `
    const output = await this.runPuppeteerCode(code, opts)
    if (output.stderr) {
      console.log(output.stderr)
      throw new Error(output.stderr)
    }
    return { selector }
  }

  async getLinks(selector?: string, opts?: { timeout?: number }): Promise<{ url: string; text: string }[]> {
    let code = selector ? `const element = await page.$('${selector}');` : ""
    code += `
            const pageUrls = await {'element' if element else 'page'}.evaluate(() => {{
              const links = Array.from(document.links);
              return links.map((link) => ({{
                url: link.href,
                text: link.textContent.replace(/\\s+/g, ' ').trim()
              }}));
            }});
            console.log(JSON.stringify(pageUrls))
        `
    const output = await this.runPuppeteerCode(code, opts)
    if (output.stderr) {
      console.log(output.stderr)
      throw new Error(output.stderr)
    }
    return JSON.parse(output.stdout)
  }

  async getImages(selector?: string, opts?: { timeout?: number }): Promise<{ href: string; text: string }[]> {
    let code = selector ? `const element = await page.$('${selector}');` : ""
    code += `
            const pageUrls = await {'element' if element else 'page'}.evaluate(() => {{
              const images = Array.from(document.images);
              return images.map((link) => ({{
                href: link.src,
                text: link.alt
              }}));
            }});
            console.log(JSON.stringify(pageUrls))
        `
    const output = await this.runPuppeteerCode(code, opts)
    if (output.stderr) {
      console.log(output.stderr)
      throw new Error(output.stderr)
    }
    return JSON.parse(output.stdout)
  }

  async getElementText(selector: string, opts?: { timeout?: number }) {
    const code = `      const element = await page.$('${selector}');
      const text = await page.evaluate(element => element.textContent, element);
      console.log(text.replace(/\\s+/g, ' ').trim())
      `
    return this.runPuppeteerCode(code, opts)
  }

  async screenshot(format: DownloadFileFormat = "buffer", selector?: string, opts?: { timeout?: number }) {
    const currentEpoch = new Date().getTime()

    const path = `/home/user/screenshot-${currentEpoch})}.png`

    let code = selector ? `const element = await page.$('${selector}');` : ""
    code += `await ${selector ? "element" : "page"}.screenshot({{path: '{path}'}})`

    const output = await this.runPuppeteerCode(code, opts)
    if (output.stderr) {
      console.log(output.stderr)
      throw new Error(output.stderr)
    }
    const screenshot = this.downloadFile(path, format)
    await this.filesystem.remove(path)
    return screenshot
  }
  async click(selector: string, opts?: { timeout?: number }) {
    const code = `await page.click('${selector}')`
    return this.runPuppeteerCode(code, opts)
  }
  async installJSPackages(packageNames: string | string[]) {
    await this.installPackages("npm install", packageNames)
  }
  private async runPuppeteerCode(code: string, opts?: { timeout?: number }) {
    const currentEpoch = new Date().getTime()

    const codeFilePath = `.index-${currentEpoch}.mjs`

    await this.filesystem.write(`/home/user/${codeFilePath}`, this.wrapFunction(code))

    const proc = await this.process.start({ cmd: `node ${codeFilePath}`, timeout: opts?.timeout })
    await proc.wait()

    await this.filesystem.remove(codeFilePath)
    return proc.output
  }
  private wrapFunction(code: string) {
    return `
        import puppeteer from "puppeteer";

        async function main(){{
            const browser = await puppeteer.connect({{browserWSEndpoint: process.env.WS_ENDPOINT}});
            const page = (await browser.pages())[0];
            ${code}
            await browser.disconnect();
        }}

        await main();
    `
  }
}
