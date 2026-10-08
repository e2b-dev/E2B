import os

from dotenv import load_dotenv
from e2b import Template, default_build_logger, wait_for_timeout
from template import make_template

load_dotenv()

alias = os.getenv("E2B_DEBUG_TEMPLATE", "code-interpreter-debug")

Template.build(
    make_template(
        kernels=["python", "javascript"],
        ready=wait_for_timeout(60_000),
        debug=True,
    ),
    alias=alias,
    cpu_count=2,
    memory_mb=2048,
    on_build_logs=default_build_logger(min_level="debug"),
)

print(f"Built debug template: {alias}")
