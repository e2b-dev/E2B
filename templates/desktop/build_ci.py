import os

from e2b import Template, default_build_logger
from template import template_with_user_workdir

Template.build(
    template_with_user_workdir,
    os.environ["E2B_TESTS_TEMPLATE"],
    cpu_count=8,
    memory_mb=8192,
    on_build_logs=default_build_logger(),
)
