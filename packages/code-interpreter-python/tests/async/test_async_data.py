from e2b_code_interpreter.code_interpreter_async import AsyncSandbox


async def test_data(async_sandbox: AsyncSandbox):
    # plot random chart
    result = await async_sandbox.run_code(
        """
        import pandas as pd
        pd.DataFrame({"a": [1, 2, 3]})
        """
    )

    # there's your image
    data = result.results[0]
    assert data.data
    assert "a" in data.data
    assert len(data.data["a"]) == 3
