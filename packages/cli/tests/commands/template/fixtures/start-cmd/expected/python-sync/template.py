from e2b import Template

template = (
    Template()
    .from_image("python:3.11")
    .set_user("root")
    .set_workdir("/")
    .set_workdir("/app")
    .run_cmd("pip install --upgrade pip")
    .run_cmd("pip install -r requirements.txt")
    .set_envs({
        "PYTHONUNBUFFERED": "1",
    })
    .set_user("user")
    .set_start_cmd("sudo node server.js", "sleep 20")
)