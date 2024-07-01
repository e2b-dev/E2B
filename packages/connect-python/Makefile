PY = python -m

plugin = protoc-gen-connect-python

dev:
	$(PY) pip install -r requirements-dev.txt

fmt:
	$(PY) ruff format src

lint:
	$(PY) ruff check src

clean:
	rm -f bin/protoc-gen-connect-python
	rm -rf dist

upload: clean
	$(PY) build
	$(PY) twine upload --repository=connect-python dist/*


bin/$(plugin): $(wildcard cmd/$(plugin)/*.go) pyproject.toml Makefile
	go build -o $@ \
	  -ldflags "-w -s" \
	  ./cmd/$(plugin)

.PHONY: dev fmt lint upload clean
