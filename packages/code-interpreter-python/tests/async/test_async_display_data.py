from e2b_code_interpreter.code_interpreter_async import AsyncSandbox


async def test_display_data(async_sandbox: AsyncSandbox):
    # plot random chart
    result = await async_sandbox.run_code(
        """
        import matplotlib.pyplot as plt
        import numpy as np

        x = np.linspace(0, 20, 100)
        y = np.sin(x)

        plt.plot(x, y)
        plt.show()
        """
    )

    # there's your image
    data = result.results[0]
    assert data.png
    assert data.text
    assert not data.extra
