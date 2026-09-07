import pytest

from e2b_code_interpreter.code_interpreter_async import AsyncSandbox


async def test_create_context_with_no_options(async_sandbox: AsyncSandbox):
    context = await async_sandbox.create_code_context()

    contexts = await async_sandbox.list_code_contexts()
    last_context = contexts[-1]

    assert last_context.id == context.id
    assert last_context.language == context.language
    assert last_context.cwd == context.cwd


async def test_create_context_with_options(async_sandbox: AsyncSandbox):
    context = await async_sandbox.create_code_context(
        language="python",
        cwd="/root",
    )

    contexts = await async_sandbox.list_code_contexts()
    last_context = contexts[-1]

    assert last_context.id == context.id
    assert last_context.language == context.language
    assert last_context.cwd == context.cwd


async def test_remove_context(async_sandbox: AsyncSandbox):
    context = await async_sandbox.create_code_context()

    await async_sandbox.remove_code_context(context.id)

    contexts = await async_sandbox.list_code_contexts()
    assert context.id not in [ctx.id for ctx in contexts]


async def test_list_contexts(async_sandbox: AsyncSandbox):
    contexts = await async_sandbox.list_code_contexts()

    # default contexts should include python and javascript
    languages = [context.language for context in contexts]
    assert "python" in languages
    assert "javascript" in languages


async def test_restart_context(async_sandbox: AsyncSandbox):
    context = await async_sandbox.create_code_context()

    # set a variable in the context
    await async_sandbox.run_code("x = 1", context=context)

    # restart the context
    await async_sandbox.restart_code_context(context.id)

    # check that the variable no longer exists
    execution = await async_sandbox.run_code("x", context=context)

    # check for a NameError with message "name 'x' is not defined"
    assert execution.error is not None
    assert execution.error.name == "NameError"
    assert execution.error.value == "name 'x' is not defined"


@pytest.mark.skip_debug
async def test_create_context_secure_traffic(async_sandbox_factory):
    async_sandbox = await async_sandbox_factory(
        secure=True, network={"allow_public_traffic": False}
    )
    context = await async_sandbox.create_code_context()

    contexts = await async_sandbox.list_code_contexts()
    last_context = contexts[-1]

    assert last_context.id == context.id
    assert last_context.language == context.language
    assert last_context.cwd == context.cwd


@pytest.mark.skip_debug
async def test_remove_context_secure_traffic(async_sandbox_factory):
    async_sandbox = await async_sandbox_factory(
        secure=True, network={"allow_public_traffic": False}
    )
    context = await async_sandbox.create_code_context()

    await async_sandbox.remove_code_context(context.id)

    contexts = await async_sandbox.list_code_contexts()
    assert context.id not in [ctx.id for ctx in contexts]


@pytest.mark.skip_debug
async def test_list_contexts_secure_traffic(async_sandbox_factory):
    async_sandbox = await async_sandbox_factory(
        secure=True, network={"allow_public_traffic": False}
    )
    contexts = await async_sandbox.list_code_contexts()

    # default contexts should include python and javascript
    languages = [context.language for context in contexts]
    assert "python" in languages
    assert "javascript" in languages


@pytest.mark.skip_debug
async def test_restart_context_secure_traffic(async_sandbox_factory):
    async_sandbox = await async_sandbox_factory(
        secure=True, network={"allow_public_traffic": False}
    )
    context = await async_sandbox.create_code_context()

    # set a variable in the context
    await async_sandbox.run_code("x = 1", context=context)

    # restart the context
    await async_sandbox.restart_code_context(context.id)

    # check that the variable no longer exists
    execution = await async_sandbox.run_code("x", context=context)

    # check for a NameError with message "name 'x' is not defined"
    assert execution.error is not None
    assert execution.error.name == "NameError"
    assert execution.error.value == "name 'x' is not defined"
