import logging
from os import getenv
from time import sleep

from dotenv import load_dotenv

from e2b import Sandbox

load_dotenv()
id = "Python3"
E2B_API_KEY = getenv("E2B_API_KEY")

logging.basicConfig(level=logging.ERROR)


def main():
    s = Sandbox(api_key=E2B_API_KEY)
    a = s.process.start("ls -la /home/user")
    s.filesystem.write("/home/user/test.txt", "Hello World!")
    a.wait()
    s.keep_alive(60)
    s.close()

    sleep(20)
    s2 = Sandbox.reconnect(s.id, api_key=E2B_API_KEY)
    print(s2.filesystem.read("/home/user/test.txt"))
    s2.close()


main()
