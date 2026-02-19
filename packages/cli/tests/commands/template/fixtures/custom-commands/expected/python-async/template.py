from e2b import AsyncTemplate

template = (
    AsyncTemplate()
    .from_image("node:18")
    .set_user("root")
    .set_workdir("/")
    .set_workdir("/app")
    .copy("server.js", ".")
    .set_user("user")
    .set_start_cmd("sudo node server.js", "curl -f http://localhost:3000/health || exit 1")
)