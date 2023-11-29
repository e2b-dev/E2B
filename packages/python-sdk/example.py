import logging
from os import getenv

from dotenv import load_dotenv

from e2b import Sandbox, constants

load_dotenv()
id = "Python3"
E2B_API_KEY = getenv("E2B_API_KEY")

logging.basicConfig(level=logging.ERROR)


def main():
    s = Sandbox("idnrwvs3vrde6hknozc0", api_key=E2B_API_KEY)

    a = s.process.start("ls -la /var ")
    a.wait()
    print(a.stdout)
    print(a.stderr)
    s.close()
    return


main()
