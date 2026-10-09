from e2b import Template
from template import template

# output the template to stdout to pipe into docker buildx
print(Template.to_dockerfile(template))
