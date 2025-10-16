import asyncio
from e2b import AsyncTemplate, default_build_logger
from .template import template


async def main():
    await AsyncTemplate.build(
        template,
        alias="start-cmd",
        cpu_count=2,
        memory_mb=1024,
        on_build_logs=default_build_logger(),
    )


if __name__ == "__main__":
    asyncio.run(main())