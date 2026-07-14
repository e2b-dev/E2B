---
"@e2b/python-sdk": patch
---

Fix inverted `no_install_recommends` docstring on `TemplateBuilder.apt_install()`.
The docstring described the parameter as "Whether to install recommended
packages", but the code passes apt-get's `--no-install-recommends` flag when the
argument is `True`, which skips recommended packages, the opposite of what the
docs claimed. The docstring now describes the real behavior. No behavior change.
