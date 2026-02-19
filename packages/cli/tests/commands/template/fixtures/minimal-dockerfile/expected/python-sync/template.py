from e2b import Template

template = (
    Template()
    .from_image("ubuntu:latest")
    .set_user("root")
    .set_workdir("/")
    .set_user("user")
    .set_workdir("/home/user")
)