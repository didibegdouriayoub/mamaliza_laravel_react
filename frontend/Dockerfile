FROM oven/bun:1 as base

WORKDIR /app

# Install dependencies into temp directory
# This will cache them and speed up future builds
COPY package.json bun.lockb ./
RUN bun install

# Copy project files
COPY . .

EXPOSE 5173

# Run the dev server exposing host
CMD ["bun", "run", "dev", "--host", "0.0.0.0"]
