import json
from typing import Mapping, Optional, AsyncIterable

from fastapi.encoders import jsonable_encoder
from starlette.background import BackgroundTask
from fastapi.responses import StreamingResponse


class StreamingListJsonResponse(StreamingResponse):
    """Converts a pydantic model generator into a streaming HTTP Response
    that streams a JSON list, one element at a time.

    See https://github.com/tiangolo/fastapi/issues/1978
    """

    def __init__(
        self,
        content_generator: AsyncIterable,
        status_code: int = 200,
        headers: Optional[Mapping[str, str]] = None,
        media_type: Optional[str] = None,
        background: Optional[BackgroundTask] = None,
    ) -> None:
        body_iterator = self._encoded_async_generator(content_generator)

        super().__init__(
            content=body_iterator,
            status_code=status_code,
            headers=headers,
            media_type=media_type,
            background=background,
        )

    async def _encoded_async_generator(self, async_generator: AsyncIterable):
        """Converts an asynchronous pydantic model generator
        into a streaming JSON list
        """
        async for item in async_generator:
            yield f"{json.dumps(jsonable_encoder(item))}\n"
        yield '{"type": "end_of_execution"}\n'
