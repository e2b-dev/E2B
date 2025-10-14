from e2b import AsyncTemplate

template = (
    AsyncTemplate()
    .from_image("ubuntu:latest")
    .set_user("root")
    .set_workdir("/")
)