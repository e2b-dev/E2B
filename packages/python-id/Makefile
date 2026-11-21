typecheck:
	ty check

lint:
	ruff check .
	ruff format --check .

format:
	ruff format .

.PHONY: test
test:
	uv run pytest --verbose
