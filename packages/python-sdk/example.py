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

    stdout, stderr = s.go_to("https://www.reddit.com/r/programming/", timeout=60).get_content(timeout=60)
    print(stdout, stderr)
    s.close()


main()
