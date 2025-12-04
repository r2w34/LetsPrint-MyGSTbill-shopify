# Multi-stage build for production optimization
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache openssl python3 make g++

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache openssl curl

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S shopify -u 1001

WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy package files
COPY package.json package-lock.json* ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder --chown=shopify:nodejs /app/build ./build
COPY --from=builder --chown=shopify:nodejs /app/public ./public
COPY --from=builder --chown=shopify:nodejs /app/prisma ./prisma

# Copy other necessary files
COPY --chown=shopify:nodejs . .

# Generate Prisma client
RUN npx prisma generate

# Create health check endpoint
RUN echo '#!/bin/sh\ncurl -f http://localhost:3000/health || exit 1' > /usr/local/bin/healthcheck && \
    chmod +x /usr/local/bin/healthcheck

# Switch to non-root user
USER shopify

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD /usr/local/bin/healthcheck

# Start the application
CMD ["npm", "run", "docker-start"]
