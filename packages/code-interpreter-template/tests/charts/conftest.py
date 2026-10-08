import pytest

from harness import CodeInterpreter


@pytest.fixture()
def run_chart(client: CodeInterpreter):
    def run(code: str) -> dict:
        execution = client.run_code(code)
        assert execution.error is None, execution.error
        chart = execution.results[0].chart
        assert chart
        return chart

    return run
