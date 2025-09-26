import asyncio
from e2b import AsyncTemplate
from template import template


async def main():
    await AsyncTemplate.build(
        template,
        alias="start-cmd",
        cpu_count=2,
        memory_mb=1024,
    )


if __name__ == "__main__":
    asyncio.run(main())
