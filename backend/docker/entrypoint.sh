#!/bin/bash
set -e

echo "==> Starting Fromagerie API..."

# Install PHP dependencies if vendor is missing (volume mount doesn't include vendor/)
if [ ! -f /var/www/html/vendor/autoload.php ]; then
    echo "==> Installing PHP dependencies..."
    composer install --no-interaction --prefer-dist --optimize-autoloader
fi

# Generate APP_KEY if not provided (defense-in-depth; prefer setting it in docker-compose)
if [ -z "$APP_KEY" ]; then
    echo "==> APP_KEY not set — generating a temporary one..."
    export APP_KEY="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
fi

# Write a complete .env so Laravel always has DB + app config regardless of
# how system env vars are resolved. Volume mount shares this file with the host.
cat > /var/www/html/.env << EOF
APP_NAME=${APP_NAME:-Fromagerie}
APP_ENV=${APP_ENV:-local}
APP_KEY=${APP_KEY}
APP_DEBUG=${APP_DEBUG:-true}
APP_URL=${APP_URL:-http://localhost:8000}

DB_CONNECTION=${DB_CONNECTION:-mysql}
DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-3306}
DB_DATABASE=${DB_DATABASE:-fromagerie}
DB_USERNAME=${DB_USERNAME:-fromagerie}
DB_PASSWORD=${DB_PASSWORD:-secret}

CACHE_STORE=${CACHE_STORE:-database}
QUEUE_CONNECTION=${QUEUE_CONNECTION:-database}

SANCTUM_STATELESS_DOMAINS=${SANCTUM_STATELESS_DOMAINS:-localhost:5173}
FRONTEND_URL=${FRONTEND_URL:-http://localhost:5173}
EOF

# Wait for MySQL (db healthcheck already passed, but belt-and-suspenders)
echo "==> Checking database connection..."
until php -r "
  try {
    \$pdo = new PDO(
      'mysql:host=' . getenv('DB_HOST') . ';dbname=' . getenv('DB_DATABASE'),
      getenv('DB_USERNAME'),
      getenv('DB_PASSWORD')
    );
    echo 'OK';
  } catch(Exception \$e) {
    exit(1);
  }
" 2>/dev/null | grep -q OK; do
  echo "  Waiting for database..."
  sleep 2
done

echo "==> Database ready!"

# Run migrations
echo "==> Running migrations..."
php artisan migrate --force

# Seed only in local env
if [ "$APP_ENV" = "local" ]; then
  echo "==> Seeding database..."
  php artisan db:seed --force --no-interaction 2>/dev/null || true
fi

# Run legacy import once (idempotent — seeder skips if already imported)
echo "==> Running legacy bakery import (skips if already done)..."
php artisan db:seed --class=LegacyImportSeeder --force --no-interaction

echo "==> Caching Laravel config and routes..."
php artisan config:cache
php artisan route:cache

echo "==> Starting PHP-FPM..."
php-fpm -D -R

echo "==> Starting Nginx on port 8000..."
exec nginx -g 'daemon off;'
