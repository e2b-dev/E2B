import logging
from os import getenv

from dotenv import load_dotenv

from e2b.templates import CloudBrowser

load_dotenv()
id = "Python3"
E2B_API_KEY = getenv("E2B_API_KEY")

logging.basicConfig(level=logging.ERROR)


def main():
    s = CloudBrowser(api_key=E2B_API_KEY)

    s.go_to("https://www.reddit.com/r/programming/", timeout=60)
    print(s.url)

    s.click(s.get_element("a"))

    print(s.url)

    with open("test.png", "wb") as f:
        f.write(s.screenshot())

    s.close()


main()
