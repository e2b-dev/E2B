# from typing import Coroutine, Any

import dotenv

dotenv.load_dotenv()

from e2b import Sandbox

sbx = Sandbox()

r = sbx.list()

print(r)

f = sbx.files.list("/")

print(f)


# sbx.files.list("/")


# async def a():
#     return "a"


# x = a()
