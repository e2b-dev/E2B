from template import make_template
from e2b import Template

tmp = make_template(kernels=["python", "javascript"], is_docker=True)
print(Template.to_dockerfile(tmp))
