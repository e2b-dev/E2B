import json
import logging
import time

from typing import Optional, Tuple, List, Union

from e2b.constants import TIMEOUT
from e2b.templates.template import BaseTemplate

logger = logging.getLogger(__name__)


class CloudBrowser(BaseTemplate):
    sandbox_template_id = "cloud-browser"

    @property
    def url(self) -> str:
        code = f"""console.log(await page.url())"""
        stdout, stderr = self._run_puppeteer_code(code)
        if stderr:
            logger.error(stderr)
            raise Exception(stderr)

        return stdout

    def go_to(
        self,
        url: str,
        timeout: Optional[float] = TIMEOUT,
    ) -> "CloudBrowser":
        code = f"""await page.goto("{url}")"""
        self._run_puppeteer_code(code, timeout=timeout)

        return self

    def get_content(
        self,
        selector: Optional[str] = None,
        timeout: Optional[float] = TIMEOUT,
    ) -> Tuple[str, str]:
        if selector:
            code = f"const content = await page.evaluate(() = > document.querySelector('{selector}').outerHTML)\n"
        else:
            code = f"const content = await page.content()\n"
        code += "console.log(content)"

        return self._run_puppeteer_code(code, timeout=timeout)

    def get_links(
        self,
        selector: Optional[str] = None,
        timeout: Optional[float] = TIMEOUT,
    ) -> List[dict]:
        code = ""
        if selector:
            code += f"""const element = await page.$('{selector}');"""

        code += f"""
            const pageUrls = await {'element' if selector else 'page'}.evaluate(() => {{
              const links = Array.from(document.links);
              return links.map((link) => ({{
                url: link.href,
                text: link.textContent.replace(/\\s+/g, ' ').trim()
              }}));
            }});
            console.log(JSON.stringify(pageUrls))
        """
        stdout, stderr = self._run_puppeteer_code(code, timeout=timeout)
        if stderr:
            logger.error(stderr)
            raise Exception(stderr)

        elements = json.loads(stdout)
        return elements

    def get_images(
        self,
        selector: Optional[str] = None,
        timeout: Optional[float] = TIMEOUT,
    ) -> List[dict]:
        code = ""
        if selector:
            code += f"""const element = await page.$('{selector}');"""

        code += f"""
            const pageUrls = await {'element' if selector else 'page'}.evaluate(() => {{
              const images = Array.from(document.images);
              return images.map((link) => ({{
                href: link.src,
                text: link.alt
              }}));
            }});
            console.log(JSON.stringify(pageUrls))
        """
        stdout, stderr = self._run_puppeteer_code(code, timeout=timeout)
        if stderr:
            logger.error(stderr)
            raise Exception(stderr)

        elements = json.loads(stdout)
        return elements

    def get_element_text(
        self,
        selector: str,
        timeout: Optional[float] = TIMEOUT,
    ) -> Tuple[str, str]:
        code = f"""
            const element = await page.$('{selector}');
            const text = await page.evaluate(element => element.textContent, element);
            console.log(text.replace(/\\s+/g, ' ').trim())
        """
        return self._run_puppeteer_code(code, timeout=timeout)

    def screenshot(
        self,
        selector: Optional[str] = None,
        timeout: Optional[float] = TIMEOUT,
    ) -> bytes:
        path = f"/home/user/screenshot-{time.strftime('%Y%m%d-%H%M%S')}.png"

        code = ""
        if selector:
            code += f"""const element = await page.$('{selector}');"""

        code += f"""
            await {'element' if selector else 'page'}.screenshot({{path: '{path}'}})
        """
        _, stderr = self._run_puppeteer_code(code, timeout=timeout)
        if stderr:
            logger.error(stderr)
            raise Exception(stderr)

        screenshot = self.download_file(path, timeout=timeout)
        self.filesystem.remove(path)
        return screenshot

    def click(
        self,
        selector: str,
        timeout: Optional[float] = TIMEOUT,
    ) -> Tuple[str, str]:
        code = f"""await page.click('{selector}')"""
        return self._run_puppeteer_code(code, timeout=timeout)

    def install_js_packages(
        self, package_names: Union[str, List[str]], timeout: Optional[float] = TIMEOUT
    ) -> None:
        self._install_packages("npm install", package_names, timeout=timeout)

    def _run_puppeteer_code(
        self, code: str, timeout: Optional[float] = TIMEOUT
    ) -> Tuple[str, str]:
        code_file_path = f".index-{time.strftime('%Y%m%d-%H%M%S')}.mjs"

        self.filesystem.write(f"/home/user/{code_file_path}", self._wrap_function(code))

        process = self.process.start(f"node {code_file_path}", timeout=timeout)
        process.wait()

        self.filesystem.remove(code_file_path)
        return process.output.stdout, process.output.stderr

    @staticmethod
    def _wrap_function(code: str):
        return f"""
        import puppeteer from "puppeteer";

        async function main(){{ 
            const browser = await puppeteer.connect({{browserWSEndpoint: process.env.WS_ENDPOINT}});
            const page = (await browser.pages())[0];
            {code}
            await browser.disconnect();
        }}

        await main();
        """
