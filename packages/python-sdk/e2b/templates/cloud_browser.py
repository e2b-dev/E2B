import logging
import time
from typing import Optional, Tuple, List, Union

from e2b.constants import TIMEOUT
from e2b.templates.template import BaseTemplate

logger = logging.getLogger(__name__)


class CloudBrowser(BaseTemplate):
    sandbox_template_id = "cloud-browser"

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
            timeout: Optional[float] = TIMEOUT,
    ) -> Tuple[str, str]:
        code = """
            const content = await page.content();
            console.log(content)
        """
        return self._run_puppeteer_code(code, timeout=timeout)

    def install_js_packages(
        self, package_names: Union[str, List[str]], timeout: Optional[float] = TIMEOUT
    ) -> None:
        self._install_packages("npm install", package_names, timeout=timeout)

    def _run_puppeteer_code(self, code: str, timeout: Optional[float] = TIMEOUT) -> Tuple[str, str]:
        code_file_path = f".index-{time.strftime('%Y%m%d-%H%M%S')}.mjs"

        self.filesystem.write(f"/home/user/{code_file_path}", self._wrap_function(code))

        process = self.process.start(f"node {code_file_path}", timeout=timeout, on_stderr=print, on_stdout=print)
        process.wait()

        self.filesystem.remove(code_file_path)
        return process.output.stdout, process.output.stderr

    @staticmethod
    def _wrap_function(code: str):
        return """
        import puppeteer from "puppeteer";

        async function main(){ 
            const browser = await puppeteer.connect({browserWSEndpoint: process.env.WS_ENDPOINT});
            const page = (await browser.pages())[0];
            %s
            await browser.disconnect();
        }

        await main();
        """ % code
