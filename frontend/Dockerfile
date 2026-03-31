FROM oven/bun:1 as base

WORKDIR /app

# Install dependencies into temp directory
# This will cache them and speed up future builds
COPY package.json bun.lockb ./
RUN bun install

# Copy project files
COPY . .

EXPOSE 8080

# Run the dev server exposing host (vite.config.ts sets port 8080)
CMD ["bun", "run", "dev", "--host", "0.0.0.0"]
