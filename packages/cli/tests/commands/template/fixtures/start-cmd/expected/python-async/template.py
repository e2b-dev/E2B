from e2b import AsyncTemplate

template = (
    AsyncTemplate()
    .from_image("python:3.11")
    .set_workdir("/app")
    .run_cmd("pip install --upgrade pip")
    .run_cmd("pip install -r requirements.txt")
    .set_envs({
        "PYTHONUNBUFFERED": "1",
    })
    .set_start_cmd("node server.js", "sleep 20")
)
