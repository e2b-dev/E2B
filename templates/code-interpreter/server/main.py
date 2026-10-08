import logging
import sys
import httpx

from typing import Dict, Union, Literal, List

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse

from api.models.context import Context
from api.models.create_context import CreateContext
from api.models.execution_request import ExecutionRequest
from consts import JUPYTER_BASE_URL, JUPYTER_SOCKET_PATH
from contexts import create_context, normalize_language
from messaging import ContextWebSocket
from stream import StreamingListJsonResponse
from utils.locks import LockedMap

logging.basicConfig(level=logging.DEBUG, stream=sys.stdout)
logger = logging.Logger(__name__)
http_logger = logging.getLogger("httpcore.http11")
http_logger.setLevel(logging.WARNING)


websockets: Dict[Union[str, Literal["default"]], ContextWebSocket] = {}
default_websockets = LockedMap()
global client


@asynccontextmanager
async def lifespan(app: FastAPI):
    global client
    client = httpx.AsyncClient(
        transport=httpx.AsyncHTTPTransport(uds=JUPYTER_SOCKET_PATH), trust_env=False
    )

    try:
        python_context = await create_context(
            client, websockets, "python", "/home/user"
        )
        default_websockets["python"] = python_context.id
        websockets["default"] = websockets[python_context.id]

        javascript_context = await create_context(
            client, websockets, "javascript", "/home/user"
        )
        default_websockets["javascript"] = javascript_context.id

        logger.info("Connected to default runtime")
        yield

        # Will cleanup after application shuts down
        for ws in websockets.values():
            await ws.close()

        await client.aclose()
    except Exception as e:
        logger.error(f"Failed to initialize default context: {e}")
        raise


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info("Starting Code Interpreter server")


@app.get("/health")
async def get_health():
    return "OK"


@app.post("/execute")
async def post_execute(request: Request, exec_request: ExecutionRequest):
    logger.info(f"Executing code: {exec_request.code}")

    if exec_request.context_id and exec_request.language:
        return PlainTextResponse(
            "Only one of context_id or language can be provided",
            status_code=400,
        )

    context_id = None
    if exec_request.language:
        language = normalize_language(exec_request.language)

        async with await default_websockets.get_lock(language):
            context_id = default_websockets.get(language)

            if not context_id:
                try:
                    context = await create_context(
                        client, websockets, language, "/home/user"
                    )
                except Exception as e:
                    return PlainTextResponse(str(e), status_code=500)

                context_id = context.id
                default_websockets[language] = context_id

    elif exec_request.context_id:
        context_id = exec_request.context_id

    if context_id:
        ws = websockets.get(context_id, None)
    else:
        ws = websockets["default"]

    if not ws:
        return PlainTextResponse(
            f"Context {exec_request.context_id} not found",
            status_code=404,
        )

    return StreamingListJsonResponse(
        ws.execute(
            exec_request.code,
            env_vars=exec_request.env_vars,
            access_token=request.headers.get("X-Access-Token", None),
        )
    )


@app.post("/contexts")
async def post_contexts(request: CreateContext) -> Context:
    logger.info("Creating a new context")

    language = normalize_language(request.language)
    cwd = request.cwd or "/home/user"

    try:
        return await create_context(client, websockets, language, cwd)
    except Exception as e:
        return PlainTextResponse(str(e), status_code=500)


@app.get("/contexts")
async def get_contexts() -> List[Context]:
    logger.info("Listing contexts")

    return [
        Context(
            id=ws.context_id,
            language=ws.language,
            cwd=ws.cwd,
        )
        for key, ws in websockets.items()
        if key != "default"
    ]


@app.post("/contexts/{context_id}/restart")
async def restart_context(context_id: str) -> None:
    logger.info(f"Restarting context {context_id}")

    ws = websockets.get(context_id, None)
    if not ws:
        return PlainTextResponse(
            f"Context {context_id} not found",
            status_code=404,
        )

    session_id = ws.session_id

    await ws.close()

    response = await client.post(
        f"{JUPYTER_BASE_URL}/api/kernels/{ws.context_id}/restart"
    )
    if not response.is_success:
        return PlainTextResponse(
            f"Failed to restart context {context_id}",
            status_code=500,
        )

    ws = ContextWebSocket(
        ws.context_id,
        session_id,
        ws.language,
        ws.cwd,
    )

    await ws.connect()

    websockets[context_id] = ws


@app.delete("/contexts/{context_id}")
async def remove_context(context_id: str) -> None:
    logger.info(f"Removing context {context_id}")

    ws = websockets.get(context_id, None)
    if not ws:
        return PlainTextResponse(
            f"Context {context_id} not found",
            status_code=404,
        )

    try:
        await ws.close()
    except:  # noqa: E722
        pass

    response = await client.delete(f"{JUPYTER_BASE_URL}/api/kernels/{ws.context_id}")
    if not response.is_success:
        return PlainTextResponse(
            f"Failed to remove context {context_id}",
            status_code=500,
        )

    del websockets[context_id]
