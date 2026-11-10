import json

from e2b_code_interpreter import Execution, ExecutionError, Logs


def test_execution_to_json_serializes_nested_objects():
    execution = Execution(
        logs=Logs(stdout=["hello"], stderr=["warning"]),
        error=ExecutionError("ValueError", "bad value", "traceback"),
    )

    payload = json.loads(execution.to_json())

    assert payload["logs"] == {
        "stdout": ["hello"],
        "stderr": ["warning"],
    }
    assert payload["error"] == {
        "name": "ValueError",
        "value": "bad value",
        "traceback": "traceback",
    }
