# E2B Template: claude-code
# This Dockerfile creates an E2B sandbox with Claude Code pre-installed
#
# Build with: e2b template build --name claude-code --dockerfile e2b.Dockerfile

FROM node:24-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ripgrep \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code@latest

# Create working directory
WORKDIR /home/user

# Verify installation
RUN claude --version
