typecheck:
	ty check e2b_docker_utils

lint:
	ruff check .
	ruff format --check .

format:
	ruff format .

.PHONY: test
test:
	uv run pytest --verbose
