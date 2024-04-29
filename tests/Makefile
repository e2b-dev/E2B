ENV := $(shell cat ../.last_used_env || echo "not-set")
E2B_DEBUG := ""
-include ../.env.${ENV}

.PHONY: test
test:
	E2B_DOMAIN=$(DOMAIN_NAME) E2B_DEBUG=$(E2B_DEBUG) E2B_API_KEY=$(E2B_API_KEY) ./test_e2b.sh
