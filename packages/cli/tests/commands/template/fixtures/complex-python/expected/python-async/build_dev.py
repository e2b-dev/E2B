import asyncio
from e2b import AsyncTemplate
from template import template


async def main():
    await AsyncTemplate.build(
        template,
        alias="Complex Python App-dev",
    )


if __name__ == "__main__":
    asyncio.run(main())
