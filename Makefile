.DEFAULT_GOAL := help

INFISICAL_ENV ?= dev
ENV_FILE := .env

NORMALIZE_ENV = grep -v -e '^[[:space:]]*\#' -e '^[[:space:]]*$$' | \
	sed -e 's/^[[:space:]]*export[[:space:]][[:space:]]*//' \
	    -e 's/^[[:space:]]*\([A-Za-z_][A-Za-z0-9_]*\)[[:space:]]*=[[:space:]]*/\1=/' \
	    -e "s/^\([A-Za-z_][A-Za-z0-9_]*\)='\(.*\)'$$/\1=\2/" \
	    -e 's/^\([A-Za-z_][A-Za-z0-9_]*\)="\(.*\)"$$/\1=\2/' | \
	sort

MASK_ENV = while IFS='=' read -r k v; do \
	  printf '%s=%s\n' "$$k" \
	    "$$(printf '%s' "$$salt$$v" | shasum -a 256 | cut -c1-12)"; \
	done
ifeq ($(SHOW_VALUES),1)
MASK_ENV = cat
endif

.PHONY: help
help: ## List available targets.
	@echo "Available targets:"
	@echo "  secrets-diff  - show how $(ENV_FILE) differs from Infisical"
	@echo "  secrets-push  - $(ENV_FILE) -> infisical/$(INFISICAL_ENV)"
	@echo "  secrets-pull  - infisical/$(INFISICAL_ENV) -> $(ENV_FILE)"

.PHONY: secrets-auth
secrets-auth:
	@if [ -z "$$INFISICAL_TOKEN" ] && ! infisical login status >/dev/null 2>&1; then \
	  echo "not logged in to Infisical -- running 'infisical login'" >&2; \
	  infisical login; \
	fi

.PHONY: secrets-diff
secrets-diff: secrets-auth ## Show how $(ENV_FILE) differs from infisical/$(INFISICAL_ENV). Writes nothing.
	@set -e; \
	tmp=$$(mktemp -d); \
	trap 'rm -rf "$$tmp"' EXIT; \
	salt=$$(od -An -tx1 -N16 /dev/urandom | tr -d ' \n'); \
	infisical export --env=$(INFISICAL_ENV) --format=dotenv --silent \
	  | $(NORMALIZE_ENV) | $(MASK_ENV) > "$$tmp/infisical"; \
	cat $(ENV_FILE) | $(NORMALIZE_ENV) | $(MASK_ENV) > "$$tmp/local"; \
	diff -u --label "infisical/$(INFISICAL_ENV)" --label "$(ENV_FILE)" \
	  "$$tmp/infisical" "$$tmp/local" \
	  && echo "$(ENV_FILE) is in sync with infisical/$(INFISICAL_ENV)" || true

.PHONY: secrets-push
secrets-push: secrets-auth ## Create/update infisical/$(INFISICAL_ENV) from $(ENV_FILE). Never deletes.
	@out=$$(infisical secrets set --env=$(INFISICAL_ENV) --file $(ENV_FILE) \
	  --output json --silent \
	  | tr '}' '\n' \
	  | sed -n 's/.*"operation":"\([^"]*\)","secretKey":"\([^"]*\)".*/  \2 -- \1/p'); \
	if [ -z "$$out" ]; then \
	  echo "push to infisical/$(INFISICAL_ENV) reported nothing -- see above" >&2; \
	  exit 1; \
	fi; \
	echo "$$out"; \
	echo "pushed $(ENV_FILE) -> infisical/$(INFISICAL_ENV)"

.PHONY: secrets-pull
secrets-pull: secrets-auth ## Overwrite $(ENV_FILE) from infisical/$(INFISICAL_ENV) (keeps $(ENV_FILE).bak).
	@set -e; \
	tmp=$$(mktemp -d); \
	trap 'rm -rf "$$tmp"' EXIT; \
	infisical export --env=$(INFISICAL_ENV) --format=dotenv --silent > "$$tmp/env"; \
	if [ ! -s "$$tmp/env" ]; then \
	  echo "infisical/$(INFISICAL_ENV) exported nothing -- $(ENV_FILE) left untouched" >&2; \
	  exit 1; \
	fi; \
	if [ -f $(ENV_FILE) ]; then \
	  cp -p $(ENV_FILE) $(ENV_FILE).bak; \
	  backup=" (previous copy: $(ENV_FILE).bak)"; \
	else \
	  backup=""; \
	fi; \
	cp "$$tmp/env" $(ENV_FILE); \
	chmod 600 $(ENV_FILE); \
	echo "pulled infisical/$(INFISICAL_ENV) into $(ENV_FILE)$$backup"
