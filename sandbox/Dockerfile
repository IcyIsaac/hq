# Sandbox image each agent runs in. Build once:
#   docker build -t tiny-hq-agent sandbox/
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates ripgrep python3 \
 && rm -rf /var/lib/apt/lists/*
RUN npm install -g @anthropic-ai/claude-code @openai/codex
RUN useradd -m agent
USER agent
WORKDIR /work
