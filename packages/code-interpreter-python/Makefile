typecheck:
	ty check e2b_code_interpreter

lint:
	ruff check .
	ruff format --check .

format:
	ruff format .

.PHONY: test
test:
	uv run pytest --verbose --numprocesses=4
