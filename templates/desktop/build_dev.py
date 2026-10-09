from dotenv import load_dotenv
from e2b import Template, default_build_logger
from template import template_with_user_workdir

load_dotenv()

Template.build(
    template_with_user_workdir,
    "desktop-dev",
    cpu_count=8,
    memory_mb=8192,
    on_build_logs=default_build_logger(),
)
