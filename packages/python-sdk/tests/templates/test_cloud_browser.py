from e2b.templates.cloud_browser import CloudBrowser


# TODO: rewrite
def test_run_playwright():
    s = CloudBrowser()
    stdout, stderr = s.run_javascript(
        """
const { chromium } = require("playwright");

async function scrapeReddit() {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    
    // Navigate to the Reddit website
    await page.goto("https://www.reddit.com/");
    
    // Get the content of the page
    const content = await page.content();
    console.log(content);
    
    // Close the browser
    await browser.close();
}
scrapeReddit();
    """
    )
    s.close()
    assert stdout != ""
    assert stderr == ""


def test_install_packages():
    s = CloudBrowser()

    s.install_js_packages("cowsay")
    s.close()
