from e2b import Template, default_build_logger
from .template import template


if __name__ == "__main__":
    Template.build(
        template,
        alias="minimal-template-dev",
        on_build_logs=default_build_logger(),
    )