from e2b import AsyncTemplate

template = (
    AsyncTemplate()
    .from_image("python:3.11-slim")
    .set_user("root")
    .set_workdir("/")
    .run_cmd("apt-get update && apt-get install -y gcc g++ make libpq-dev && rm -rf /var/lib/apt/lists/*")
    .set_envs({
        "PYTHONDONTWRITEBYTECODE": "1",
        "PYTHONUNBUFFERED": "1",
    })
    .run_cmd("useradd -m -u 1000 appuser")
    .set_workdir("/app")
    .copy("requirements.txt", ".")
    .run_cmd("pip install --upgrade pip && pip install -r requirements.txt")
    .copy("app.py", ".")
    .set_user("appuser")
    .set_start_cmd("sudo gunicorn --bind 0.0.0.0:8000 app:application", "sleep 20")
)