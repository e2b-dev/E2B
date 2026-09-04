from e2b_code_interpreter.code_interpreter_sync import Sandbox


def test_streaming_output(sandbox: Sandbox):
    out = []

    def test(line) -> None:
        out.append(line)
        return

    sandbox.run_code("print(1)", on_stdout=test)

    assert len(out) == 1
    assert out[0].line == "1\n"


def test_streaming_error(sandbox: Sandbox):
    out = []

    sandbox.run_code("import sys;print(1, file=sys.stderr)", on_stderr=out.append)

    assert len(out) == 1
    assert out[0].line == "1\n"


def test_streaming_result(sandbox: Sandbox):
    code = """
    import matplotlib.pyplot as plt
    import numpy as np

    x = np.linspace(0, 20, 100)
    y = np.sin(x)

    plt.plot(x, y)
    plt.show()

    x
    """

    out = []
    sandbox.run_code(code, on_result=out.append)

    assert len(out) == 2
