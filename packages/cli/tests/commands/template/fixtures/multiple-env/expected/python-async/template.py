from e2b import AsyncTemplate

template = (
    AsyncTemplate()
    .from_image("node:18")
    .set_user("root")
    .set_workdir("/")
    .set_envs({
        "NODE_ENV": "production",
    })
    .set_envs({
        "PORT": "3000",
    })
    .set_envs({
        "DEBUG": "false",
        "LOG_LEVEL": "info",
        "API_URL": "https://api.example.com",
    })
    .set_envs({
        "SINGLE_VAR": "single_value",
    })
    .set_workdir("/app")
    .set_user("user")
)