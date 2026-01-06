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

# Build arguments for NEXT_PUBLIC env vars (must be available at build time)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL

# Make them available during build
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Build the Next.js application
RUN npm run build

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
