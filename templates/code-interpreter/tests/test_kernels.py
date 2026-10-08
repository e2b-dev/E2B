import pytest

from harness import CodeInterpreter


def test_js_kernel(client: CodeInterpreter):
    execution = client.run_code("console.log('Hello, World!')", language="js")
    assert execution.stdout == ["Hello, World!\n"]


def test_js_esm_imports(client: CodeInterpreter):
    execution = client.run_code(
        """
        import { readFileSync } from 'fs'
        console.log(typeof readFileSync)
        """,
        language="js",
    )
    assert execution.stdout == ["function\n"]


def test_js_top_level_await(client: CodeInterpreter):
    execution = client.run_code("await Promise.resolve('Hello World!')", language="js")
    assert execution.text == "Hello World!"


@pytest.mark.skip_debug
def test_ts_kernel(client: CodeInterpreter):
    execution = client.run_code(
        "const message: string = 'Hello, World!'; console.log(message)", language="ts"
    )
    assert execution.stdout == ["Hello, World!\n"]


@pytest.mark.skip_debug
def test_r_kernel(client: CodeInterpreter):
    client.wait_for_kernel("r")
    execution = client.run_code('print("Hello, World!")', language="r")
    assert execution.stdout == ['[1] "Hello, World!"\n']


@pytest.mark.skip_debug
def test_java_kernel(client: CodeInterpreter):
    client.wait_for_kernel("java")
    execution = client.run_code('System.out.println("Hello, World!")', language="java")
    assert execution.stdout[0] == "Hello, World!"


@pytest.mark.skip_debug
def test_bash_kernel(client: CodeInterpreter):
    execution = client.run_code("echo 'Hello, World!'", language="bash")
    assert execution.stdout == ["Hello, World!\n"]
