from e2b import Template

template = (
    Template()
    .from_image("alpine:latest")
    .copy("package.json", ".")
    .copy("src/index.js", ".")
    .copy("config.json", ".")
)