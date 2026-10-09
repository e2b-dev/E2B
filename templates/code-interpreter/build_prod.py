import os

from dotenv import load_dotenv
from e2b import Template, default_build_logger
from template import make_template

load_dotenv()

skip_cache = os.getenv("SKIP_CACHE", "false").lower() == "true"

Template.build(
    make_template(),
    alias="code-interpreter-v1",
    cpu_count=2,
    memory_mb=2048,
    skip_cache=skip_cache,
    on_build_logs=default_build_logger(),
)
