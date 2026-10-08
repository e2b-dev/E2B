import os
from e2b import Template, default_build_logger
from template import make_template

build_info = Template.build(
    make_template(),
    alias=os.environ["E2B_TESTS_TEMPLATE"],
    cpu_count=2,
    memory_mb=2048,
    on_build_logs=default_build_logger(),
)

template_id = build_info.template_id
print(f"Built template ID: {template_id}")

github_output = os.getenv("GITHUB_OUTPUT")
if github_output:
    with open(github_output, "a", encoding="utf-8") as fh:
        fh.write(f"template_id={template_id}\n")
