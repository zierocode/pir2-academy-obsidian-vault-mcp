.PHONY: help test lint check smoke memory-doctor doctor

help:
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z0-9_.-]+:.*##/ {printf "%-18s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

test: ## Run automated tests
	@npm test

lint: ## Run lint/static checks
	@npm run lint

check: ## Run pre-merge checks
	@npm run check
	@~/.agents/skills/zie-dev-workflow/scripts/ecosystem-control-plane validate .ecosystem-control-plane.json

smoke: ## Run golden-path smoke verification
	@npm run smoke

memory-doctor: ## Inspect memory-bank size, freshness, and context budget
	@~/.agents/skills/zie-dev-workflow/scripts/memory-bank-doctor .

doctor: ## Inspect autonomous repo contract readiness
	@~/.agents/skills/zie-dev-workflow/scripts/doctor .
