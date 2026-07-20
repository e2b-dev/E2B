# Specs are fetched from their source-of-truth repositories (e2b-dev/infra
# and e2b-dev/belt) at the commits pinned in spec/infra-ref and spec/belt-ref.
# To update the specs, bump the pins and re-run `make codegen`.
# Set SKIP_VOLUME_SPEC=1 to skip the volume-content spec: it lives in the
# private belt repo, which fork PRs in CI have no token for.
.PHONY: fetch-specs
fetch-specs:
	./scripts/fetch-spec.sh api-spec
	./scripts/fetch-spec.sh envd-spec
ifeq ($(SKIP_VOLUME_SPEC),)
	./scripts/fetch-spec.sh volume-api-spec
endif

# Set CODEGEN_IMAGE to skip the image build and use a prebuilt image instead
# (CI builds it separately with a warm buildkit cache).
.PHONY: codegen
codegen: fetch-specs
ifeq ($(CODEGEN_IMAGE),)
	@echo "Building codegen image"
	docker build -q -t codegen-env . -f codegen.Dockerfile
endif
	@echo "Generating code"
	docker run -v $$PWD:/workspace $(or $(CODEGEN_IMAGE),codegen-env) make generate

generate: generate-js generate-python

generate-js:
	cd packages/js-sdk && pnpm generate

generate-python:
	cd packages/python-sdk && make generate

.PHONY: init-styles
init-styles:
	vale sync

