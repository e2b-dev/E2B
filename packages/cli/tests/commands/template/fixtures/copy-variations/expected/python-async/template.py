from e2b import AsyncTemplate

template = (
    AsyncTemplate()
    .from_image("alpine:latest")
    .copy("package.json", ".")
    .copy("src/index.js", ".")
    .copy("config.json", ".")
)