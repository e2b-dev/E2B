from e2b_code_interpreter.code_interpreter_async import AsyncSandbox


async def test_js_kernel(async_sandbox: AsyncSandbox):
    execution = await async_sandbox.run_code(
        "console.log('Hello, World!')", language="js"
    )
    assert execution.logs.stdout == ["Hello, World!\n"]


async def test_js_esm_imports(async_sandbox: AsyncSandbox):
    execution = await async_sandbox.run_code(
        """
    import { readFileSync } from 'fs'
    console.log(typeof readFileSync)
    """,
        language="js",
    )
    assert execution.logs.stdout == ["function\n"]


async def test_js_top_level_await(async_sandbox: AsyncSandbox):
    execution = await async_sandbox.run_code(
        """
    await Promise.resolve('Hello World!')
    """,
        language="js",
    )
    assert execution.text == "Hello World!"


async def test_ts_kernel(async_sandbox: AsyncSandbox):
    execution = await async_sandbox.run_code(
        "const message: string = 'Hello, World!'; console.log(message);", language="ts"
    )
    assert execution.logs.stdout == ["Hello, World!\n"]
