# ==========================================
# Stage 1: Builder
# ==========================================
FROM node:20-alpine AS builder

# Set working directory inside the container
WORKDIR /usr/src/app

# Copy package configurations
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including devDependencies needed for build)
RUN npm ci

# Copy the actual source code
COPY src/ ./src/

# Compile TypeScript to JavaScript (outputs to dist/)
RUN npm run build

# ==========================================
# Stage 2: Production Runner
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /usr/src/app

# Set node environment to production
ENV NODE_ENV=production

# Copy package configurations
COPY package*.json ./

# Install ONLY production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy the compiled output from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /usr/src/app

USER nodejs

# Expose the API port
EXPOSE 3000

# Start the application using the compiled bootstrap file
CMD ["node", "dist/bootstrap.js"]