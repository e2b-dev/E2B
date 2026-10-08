import pytest

from harness import CodeInterpreter, CodeInterpreterError


def test_create_context_with_no_options(client: CodeInterpreter):
    context = client.create_context()

    assert context["language"] == "python"
    assert context["cwd"] == "/home/user"
    assert client.list_contexts()[-1] == context


def test_create_context_with_options(client: CodeInterpreter):
    context = client.create_context(language="python", cwd="/root")

    assert context["language"] == "python"
    assert context["cwd"] == "/root"
    assert client.list_contexts()[-1] == context


@pytest.mark.parametrize(
    ("alias", "language"), [("js", "javascript"), ("ts", "typescript")]
)
def test_create_context_normalizes_language_alias(
    client: CodeInterpreter, alias: str, language: str
):
    context = client.create_context(language=alias)
    assert context["language"] == language


def test_remove_context(client: CodeInterpreter):
    context = client.create_context()

    client.remove_context(context["id"])

    assert context["id"] not in [ctx["id"] for ctx in client.list_contexts()]


def test_list_contexts(client: CodeInterpreter):
    languages = [context["language"] for context in client.list_contexts()]
    assert "python" in languages
    assert "javascript" in languages


def test_restart_context(client: CodeInterpreter):
    context = client.create_context()

    client.run_code("x = 1", context_id=context["id"])
    client.restart_context(context["id"])

    execution = client.run_code("x", context_id=context["id"])
    assert execution.error is not None
    assert execution.error.name == "NameError"
    assert execution.error.value == "name 'x' is not defined"


def test_independence_of_contexts(client: CodeInterpreter):
    context = client.create_context()
    client.run_code("x = 1")

    execution = client.run_code("x", context_id=context["id"])
    assert execution.error is not None
    assert execution.error.value == "name 'x' is not defined"


def test_pass_context_and_language(client: CodeInterpreter):
    context = client.create_context(language="python")

    with pytest.raises(CodeInterpreterError) as error:
        client.run_code(
            "console.log('Hello, World!')", language="js", context_id=context["id"]
        )

    assert error.value.status_code == 400
    assert "Only one of context_id or language" in error.value.body


def test_unknown_context(client: CodeInterpreter):
    with pytest.raises(CodeInterpreterError) as error:
        client.run_code("1", context_id="does-not-exist")

    assert error.value.status_code == 404


def test_restart_unknown_context(client: CodeInterpreter):
    with pytest.raises(CodeInterpreterError) as error:
        client.restart_context("does-not-exist")

    assert error.value.status_code == 404


def test_remove_unknown_context(client: CodeInterpreter):
    with pytest.raises(CodeInterpreterError) as error:
        client.remove_context("does-not-exist")

    assert error.value.status_code == 404


@pytest.mark.skip_debug
def test_contexts_secure_traffic(client_factory):
    client = client_factory(allow_public_traffic=False)

    languages = [context["language"] for context in client.list_contexts()]
    assert "python" in languages
    assert "javascript" in languages

    context = client.create_context()
    assert client.list_contexts()[-1] == context

    client.run_code("x = 1", context_id=context["id"])
    client.restart_context(context["id"])
    execution = client.run_code("x", context_id=context["id"])
    assert execution.error is not None
    assert execution.error.name == "NameError"

    client.remove_context(context["id"])
    assert context["id"] not in [ctx["id"] for ctx in client.list_contexts()]
