import asyncio
from e2b import AsyncTemplate, default_build_logger, handle_build_error
from template import template


async def main():
    try:
        await AsyncTemplate.build(
            template,
            "env-test-dev",
            on_build_logs=default_build_logger(),
        )
    except Exception as err:
        handle_build_error(err)


if __name__ == "__main__":
    asyncio.run(main())