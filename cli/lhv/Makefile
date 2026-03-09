PREFIX ?= ~/.local
BINDIR = $(PREFIX)/bin
COMPLETION_DIR = ~/.local/share/zsh/site-functions

.PHONY: build install uninstall completion clean test vet fmt lint check install-skill

build:
	go build -o lhv .

test:
	go test ./...

vet:
	go vet ./...

fmt:
	gofmt -w .

lint: vet
	@command -v staticcheck >/dev/null 2>&1 && staticcheck ./... || echo "staticcheck not installed (go install honnef.co/go/tools/cmd/staticcheck@latest)"

check: fmt vet test

install: build
	@mkdir -p $(BINDIR)
	@cp lhv $(BINDIR)/lhv
	@chmod +x $(BINDIR)/lhv
	@echo "Installed lhv to $(BINDIR)/lhv"
	@mkdir -p $(COMPLETION_DIR)
	@$(BINDIR)/lhv completion zsh > $(COMPLETION_DIR)/_lhv
	@echo "Installed zsh completion to $(COMPLETION_DIR)/_lhv"

uninstall:
	@rm -f $(BINDIR)/lhv
	@echo "Removed $(BINDIR)/lhv"
	@rm -f $(COMPLETION_DIR)/_lhv
	@echo "Removed $(COMPLETION_DIR)/_lhv"

completion:
	@mkdir -p $(COMPLETION_DIR)
	@./lhv completion zsh > $(COMPLETION_DIR)/_lhv
	@echo "Installed zsh completion to $(COMPLETION_DIR)/_lhv"

install-skill:
	@mkdir -p ~/.claude/skills/lhv
	@cp skills/lhv/SKILL.md ~/.claude/skills/lhv/SKILL.md
	@echo "Installed Claude Code skill to ~/.claude/skills/lhv/SKILL.md"

clean:
	@rm -f lhv
	@echo "Cleaned build artifacts"
