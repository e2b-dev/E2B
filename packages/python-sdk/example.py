import logging
from os import getenv

from dotenv import load_dotenv

from e2b import Session

load_dotenv()
id = "Python3"
E2B_API_KEY = getenv("E2B_API_KEY")

logging.basicConfig(level=logging.ERROR)


def main():
    s = Session("Nodejs", api_key=E2B_API_KEY, timeout=0.0001)
    a = s.process.start("ls -la /var ")
    a.wait()
    print(a.stdout)
    print(a.stderr)
    s.close()
    return


main()
