from e2b import Template, default_build_logger, handle_build_error
from template import template


if __name__ == "__main__":
    try:
        Template.build(
            template,
            "start-cmd",
            cpu_count=2,
            memory_mb=1024,
            on_build_logs=default_build_logger(),
        )
    except Exception as err:
        handle_build_error(err)