import asyncio

import httpx
import pytest

from harness import AsyncCodeInterpreter


async def test_async_basic(async_client: AsyncCodeInterpreter):
    execution = await async_client.run_code("x =1; x")
    assert execution.text == "1"


async def test_async_streaming(async_client: AsyncCodeInterpreter):
    events = [event async for event in async_client.stream_code("print(1); 2")]

    assert [event["type"] for event in events] == [
        "number_of_executions",
        "stdout",
        "result",
        "end_of_execution",
    ]
    assert events[1]["text"] == "1\n"
    assert events[2]["text"] == "2"


async def test_async_concurrent_executions(async_client: AsyncCodeInterpreter):
    executions = await asyncio.gather(
        async_client.run_code("import time; time.sleep(1); 'python'"),
        async_client.run_code(
            "await new Promise(r => setTimeout(r, 1000)); 'js'", language="js"
        ),
    )

    assert executions[0].text == "python"
    assert executions[1].text == "js"


async def test_async_interrupt(async_client: AsyncCodeInterpreter):
    with pytest.raises(httpx.TimeoutException):
        await async_client.run_code("import time; time.sleep(300)", timeout=3)

    await asyncio.sleep(5)

    execution = await async_client.run_code("1 + 1", timeout=10)
    assert execution.text == "2"
