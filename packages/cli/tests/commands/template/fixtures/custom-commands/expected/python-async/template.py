from e2b import AsyncTemplate

template = (
    AsyncTemplate()
    .from_image("node:18")
    .set_workdir("/app")
    .copy("server.js", ".")
    .set_user("root")
    .set_workdir("/home/user")
    .start_cmd("node server.js", "curl -f http://localhost:3000/health || exit 1")
)