import pytest

from e2b_code_interpreter.code_interpreter_sync import Sandbox


def test_create_context_with_no_options(sandbox: Sandbox):
    context = sandbox.create_code_context()

    contexts = sandbox.list_code_contexts()
    last_context = contexts[-1]

    assert last_context.id == context.id
    assert last_context.language == context.language
    assert last_context.cwd == context.cwd


def test_create_context_with_options(sandbox: Sandbox):
    context = sandbox.create_code_context(
        language="python",
        cwd="/root",
    )

    contexts = sandbox.list_code_contexts()
    last_context = contexts[-1]

    assert last_context.id == context.id
    assert last_context.language == context.language
    assert last_context.cwd == context.cwd


def test_remove_context(sandbox: Sandbox):
    context = sandbox.create_code_context()

    sandbox.remove_code_context(context.id)

    contexts = sandbox.list_code_contexts()
    assert context.id not in [ctx.id for ctx in contexts]


def test_list_contexts(sandbox: Sandbox):
    contexts = sandbox.list_code_contexts()

    # default contexts should include python and javascript
    languages = [context.language for context in contexts]
    assert "python" in languages
    assert "javascript" in languages


def test_restart_context(sandbox: Sandbox):
    context = sandbox.create_code_context()

    # set a variable in the context
    sandbox.run_code("x = 1", context=context)

    # restart the context
    sandbox.restart_code_context(context.id)

    # check that the variable no longer exists
    execution = sandbox.run_code("x", context=context)

    # check for a NameError with message "name 'x' is not defined"
    assert execution.error is not None
    assert execution.error.name == "NameError"
    assert execution.error.value == "name 'x' is not defined"


# Secure traffic tests (public traffic disabled)
@pytest.mark.skip_debug
def test_create_context_secure_traffic(sandbox_factory):
    sandbox = sandbox_factory(network={"allow_public_traffic": False})
    context = sandbox.create_code_context()

    contexts = sandbox.list_code_contexts()
    last_context = contexts[-1]

    assert last_context.id == context.id
    assert last_context.language == context.language
    assert last_context.cwd == context.cwd


@pytest.mark.skip_debug
def test_remove_context_secure_traffic(sandbox_factory):
    sandbox = sandbox_factory(network={"allow_public_traffic": False})
    context = sandbox.create_code_context()

    sandbox.remove_code_context(context.id)

    contexts = sandbox.list_code_contexts()
    assert context.id not in [ctx.id for ctx in contexts]


@pytest.mark.skip_debug
def test_list_contexts_secure_traffic(sandbox_factory):
    sandbox = sandbox_factory(network={"allow_public_traffic": False})
    contexts = sandbox.list_code_contexts()

    # default contexts should include python and javascript
    languages = [context.language for context in contexts]
    assert "python" in languages
    assert "javascript" in languages


@pytest.mark.skip_debug
def test_restart_context_secure_traffic(sandbox_factory):
    sandbox = sandbox_factory(network={"allow_public_traffic": False})
    context = sandbox.create_code_context()

    # set a variable in the context
    sandbox.run_code("x = 1", context=context)

    # restart the context
    sandbox.restart_code_context(context.id)

    # check that the variable no longer exists
    execution = sandbox.run_code("x", context=context)

    # check for a NameError with message "name 'x' is not defined"
    assert execution.error is not None
    assert execution.error.name == "NameError"
    assert execution.error.value == "name 'x' is not defined"
