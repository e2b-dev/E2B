from dotenv import load_dotenv
from e2b import Template, default_build_logger
from template import make_template

load_dotenv()

Template.build(
    make_template(kernels=["python", "javascript"]),
    alias="code-interpreter-dev",
    cpu_count=2,
    memory_mb=2048,
    on_build_logs=default_build_logger(min_level="debug"),
)
