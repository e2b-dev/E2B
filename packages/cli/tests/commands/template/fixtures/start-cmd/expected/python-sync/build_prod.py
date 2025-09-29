from e2b import Template
from template import template


if __name__ == "__main__":
    Template.build(
        template,
        alias="start-cmd",
        cpu_count=2,
        memory_mb=1024,
    )
