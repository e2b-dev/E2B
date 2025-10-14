from e2b import AsyncTemplate

template = (
    AsyncTemplate()
    .from_image("alpine:latest")
    .set_user("root")
    .set_workdir("/")
    .copy("package.json", "/app/")
    .copy("src/index.js", "./src/")
    .copy("config.json", "/etc/app/config.json")
)