from harness import CodeInterpreter


def _types(events: list[dict]) -> list[str]:
    return [event["type"] for event in events]


def test_streaming_stdout(client: CodeInterpreter):
    events = list(client.stream_code("print(1)"))

    stdout = [event for event in events if event["type"] == "stdout"]
    assert len(stdout) == 1
    assert stdout[0]["text"] == "1\n"
    assert "timestamp" in stdout[0]
    assert events[-1] == {"type": "end_of_execution"}


def test_streaming_stderr(client: CodeInterpreter):
    events = list(client.stream_code("import sys;print(1, file=sys.stderr)"))

    stderr = [event for event in events if event["type"] == "stderr"]
    assert len(stderr) == 1
    assert stderr[0]["text"] == "1\n"


def test_streaming_result(client: CodeInterpreter):
    code = """
    import matplotlib.pyplot as plt
    import numpy as np

    x = np.linspace(0, 20, 100)
    y = np.sin(x)

    plt.plot(x, y)
    plt.show()

    x
    """

    events = list(client.stream_code(code))

    results = [event for event in events if event["type"] == "result"]
    assert len(results) == 2
    assert results[0]["is_main_result"] is False
    assert results[1]["is_main_result"] is True


def test_event_order(client: CodeInterpreter):
    events = list(client.stream_code("print('a'); 1"))

    assert _types(events) == [
        "number_of_executions",
        "stdout",
        "result",
        "end_of_execution",
    ]


def test_stdout_streams_before_execution_finishes(client: CodeInterpreter):
    import time

    arrival = []
    for event in client.stream_code(
        "import time; print('a'); time.sleep(2); print('b')"
    ):
        if event["type"] == "stdout":
            arrival.append((event["text"], time.monotonic()))

    assert [text for text, _ in arrival] == ["a\n", "b\n"]
    assert arrival[1][1] - arrival[0][1] >= 1.5
