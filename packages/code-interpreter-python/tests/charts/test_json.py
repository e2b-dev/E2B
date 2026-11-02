import json

from e2b_code_interpreter.code_interpreter_async import AsyncSandbox
from e2b_code_interpreter.models import Result, Execution

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


def test_result_to_json_includes_data_field():
    """Test that Result.to_json includes data field when present"""
    result = Result(text="table", data={"columns": ["answer"], "rows": [[42]]})
    execution = Execution(results=[result])
    serialized = execution.to_json()
    data = json.loads(serialized)
    assert "data" in data["results"][0]
    assert data["results"][0]["data"] == {"columns": ["answer"], "rows": [[42]]}


def test_result_to_json_includes_empty_data_field():
    """Test that Result.to_json includes empty data field"""
    result = Result(text="table", data={})
    execution = Execution(results=[result])
    serialized = execution.to_json()
    data = json.loads(serialized)
    assert "data" in data["results"][0]
    assert data["results"][0]["data"] == {}


def test_result_to_json_omits_data_field_when_none():
    """Test that Result.to_json omits data field when None"""
    result = Result(text="table", data=None)
    execution = Execution(results=[result])
    serialized = execution.to_json()
    data = json.loads(serialized)
    assert "data" not in data["results"][0]
