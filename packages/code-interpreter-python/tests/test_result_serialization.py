import json

import pytest

from e2b_code_interpreter import Execution
from e2b_code_interpreter.models import async_parse_output, parse_output


@pytest.mark.parametrize("data", [{}, {"columns": ["answer"], "rows": [[42]]}, None])
@pytest.mark.parametrize("use_async", [False, True])
async def test_execution_json_preserves_result_data(data, use_async):
    execution = Execution()
    message = {"type": "result", "text": "table", "is_main_result": True}
    if data is not None:
        message["data"] = data

    output = json.dumps(message)
    if use_async:
        await async_parse_output(execution, output)
    else:
        parse_output(execution, output)

    expected = {"text": "table"}
    if data is not None:
        expected["data"] = data
        assert "data" in execution.results[0].formats()
    else:
        assert "data" not in execution.results[0].formats()
    assert json.loads(execution.to_json())["results"] == [expected]
