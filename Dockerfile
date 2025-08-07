# Stage 1 Build env
FROM node:20-alpine AS Build

# working dir
WORKDIR /usr/src/app

# Enable corepack, this allow using pnpm
RUN corepack enable

# Copy package.json and pnpm-lock.yaml for dep installation
COPY package.json pnpm-lock.yaml ./

# Install all dependencies (including devDep for building)
RUN pnpm install

COPY . .

# Build the TypeScript code into a /dist dir
RUN pnpm run build

# Stage 2 Production Runtime env
# Use a much smaller Node.js image to run the application
FROM node:20-alpine AS serve

WORKDIR /usr/src/app

RUN corepack enable

# Install PostgreSQL client tools for pg_isready
RUN apk add postgresql-client

COPY package.json pnpm-lock.yaml ./

# Install only production dep
RUN pnpm install --prod --frozen-lockfile

# Copy the built application files from the 'build' stage
COPY --from=Build /usr/src/app/dist ./dist

# Copy the prod entrypoint script into the container
COPY entrypoint.prod.sh .

# Make the prod entrypoint script executable
RUN chmod +x entrypoint.prod.sh


# Expose running port
EXPOSE 5473

# Define the command to run the production application
CMD ["./entrypoint.prod.sh"]