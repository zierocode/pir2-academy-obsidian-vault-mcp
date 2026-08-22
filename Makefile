.PHONY: help test lint check smoke status release deploy rollback memory-doctor doctor

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

status: ## Report the local release-candidate state
	@node -e "const c=require('node:crypto'),f=require('node:fs'),p=require('./package.json'),b='dist/pir-acdm-obsidian-vault-'+p.version+'.mcpb'; console.log('version='+p.version); console.log(f.existsSync(b)?'bundle='+b+' sha256='+c.createHash('sha256').update(f.readFileSync(b)).digest('hex'):'bundle=absent')"

release: ## Build and verify the local release candidate
	@npm run scan:secrets
	@npm run bundle
	@npm run bundle:verify

deploy: ## Explain the distribution boundary for this local MCPB
	@echo "deploy=not-applicable distribution=github-release asset=mcpb"

rollback: ## Report the release rollback boundary
	@echo "rollback=git-revert release-action=github-owner-confirmation"

memory-doctor: ## Inspect memory-bank size, freshness, and context budget
	@~/.agents/skills/zie-dev-workflow/scripts/memory-bank-doctor .

doctor: ## Inspect autonomous repo contract readiness
	@~/.agents/skills/zie-dev-workflow/scripts/doctor .
