from e2b_code_interpreter.code_interpreter_async import AsyncSandbox


async def test_streaming_output(async_sandbox: AsyncSandbox):
    out = []

    def test(line) -> None:
        out.append(line)
        return

    await async_sandbox.run_code("print(1)", on_stdout=test)

    assert len(out) == 1
    assert out[0].line == "1\n"


async def test_streaming_error(async_sandbox: AsyncSandbox):
    out = []

    await async_sandbox.run_code(
        "import sys;print(1, file=sys.stderr)", on_stderr=out.append
    )

    assert len(out) == 1
    assert out[0].line == "1\n"


async def test_streaming_result(async_sandbox: AsyncSandbox):
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
    await async_sandbox.run_code(code, on_result=out.append)

    assert len(out) == 2
