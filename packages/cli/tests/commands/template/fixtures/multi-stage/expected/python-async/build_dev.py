import asyncio
from e2b import AsyncTemplate, default_build_logger
from .template import template


async def main():
    await AsyncTemplate.build(
        template,
        alias="multi-stage-dev",
        on_build_logs=default_build_logger(),
    )


if __name__ == "__main__":
    asyncio.run(main())