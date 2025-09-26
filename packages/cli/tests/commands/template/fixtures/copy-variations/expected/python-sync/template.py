from e2b import Template

template = (
    Template()
    .from_image("alpine:latest")
    .copy("package.json", "/app/")
    .copy("src/index.js", "./src/")
    .copy("config.json", "/etc/app/config.json")
)