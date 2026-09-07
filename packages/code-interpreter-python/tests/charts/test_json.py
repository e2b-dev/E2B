import json

from e2b_code_interpreter.code_interpreter_async import AsyncSandbox

code = """
import matplotlib.pyplot as plt
import numpy as np

# Create data
N = 5
x = np.random.rand(N)
y = np.random.rand(N)

plt.xlabel("A")

plt.scatter(x, y, c='blue', label='Dataset')

plt.show()
"""


async def test_scatter_chart(async_sandbox: AsyncSandbox):
    result = await async_sandbox.run_code(code)
    serialized = result.to_json()
    assert isinstance(serialized, str)

    assert json.loads(serialized)["results"][0]["chart"]["type"] == "scatter"
