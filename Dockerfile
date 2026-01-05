# Use Node.js 22 (matching your local environment)
FROM node:22-slim

# Install system dependencies that the Claude Agent SDK might need
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    bash \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Install Claude Code CLI globally (required by Agent SDK)
# This ensures the CLI is available in PATH for subprocess spawning
RUN npm install -g @anthropic-ai/claude-code

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Build the Next.js application
RUN npm run build

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
