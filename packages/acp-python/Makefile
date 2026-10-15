typecheck:
	ty check e2b_acp

lint:
	ruff check .
	ruff format --check .

format:
	ruff format .

.PHONY: test
test:
	uv run pytest --verbose --numprocesses=4
