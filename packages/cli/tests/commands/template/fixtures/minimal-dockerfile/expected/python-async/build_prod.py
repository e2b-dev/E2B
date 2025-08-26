import asyncio
from e2b import AsyncTemplate
from template import template


async def main():
    await AsyncTemplate.build(
        template,
        alias="minimal-template",
    )


if __name__ == "__main__":
    asyncio.run(main())
