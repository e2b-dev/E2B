ENV := $(shell cat ../.last_used_env || echo "not-set")
-include ../.env.${ENV}

.PHONY: test
test:
	E2B_DOMAIN=$(DOMAIN_NAME) ./build_and_try.sh
