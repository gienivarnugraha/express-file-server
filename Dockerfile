# --- Stage 1: Build & Install Dependencies ---
FROM node:22-alpine AS builder

# Enable corepack and set up pnpm
RUN corepack enable
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Install Python and Pip for potential native dependencies during install
RUN apk update && \
    apk add --no-cache python3 py3-pip

    
WORKDIR /app
    
COPY package.json pnpm-lock.yaml ./

COPY requirements.txt ./

RUN pip3 install -r requirements.txt
    
# Use a conventional pnpm store path for the cache mount
# The target is the cache directory *inside* the container for this command
RUN --mount=type=cache,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile --prefer-offline

# Copy application source code
COPY . .

# --- Stage 2: Production Runtime ---
# Use a lean runtime image
FROM node:22-alpine AS runner

WORKDIR /app

# Copy only the necessary files from the builder stage
# /node_modules is the standard output of pnpm install
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/index.js ./index.js
# Copy other application files (e.g., config, routes, etc.)
COPY --from=builder /app .

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

EXPOSE 3000

# FIX: Removed the leading dot from index.js
CMD ["node", "index.js"]