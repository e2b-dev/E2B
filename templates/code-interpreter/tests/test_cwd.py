import pytest

from harness import CodeInterpreter

pytestmark = pytest.mark.skip_debug


def test_cwd_python(client: CodeInterpreter):
    execution = client.run_code("from pathlib import Path; print(Path.cwd())")
    assert "".join(execution.stdout).strip() == "/home/user"


def test_cwd_javascript(client: CodeInterpreter):
    execution = client.run_code("process.cwd()", language="js")
    assert execution.text == "/home/user"


def test_cwd_typescript(client: CodeInterpreter):
    execution = client.run_code("process.cwd()", language="ts")
    assert execution.text == "/home/user"


def test_cwd_r(client: CodeInterpreter):
    client.wait_for_kernel("r")
    execution = client.run_code("getwd()", language="r")
    assert execution.results[0].text.strip() == '[1] "/home/user"'


def test_cwd_java(client: CodeInterpreter):
    client.wait_for_kernel("java")
    execution = client.run_code('System.getProperty("user.dir")', language="java")
    assert execution.results[0].text.strip() == "/home/user"


def test_cwd_bash(client: CodeInterpreter):
    execution = client.run_code("pwd", language="bash")
    assert "".join(execution.stdout).strip() == "/home/user"


def test_custom_cwd_context(client: CodeInterpreter):
    context = client.create_context(language="python", cwd="/tmp")
    execution = client.run_code("import os; os.getcwd()", context_id=context["id"])
    assert execution.text == "/tmp"
