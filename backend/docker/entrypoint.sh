#!/bin/bash
set -e

echo "==> Starting Fromagerie API..."

# Install PHP dependencies if vendor is missing (volume mount doesn't include vendor/)
if [ ! -f /var/www/html/vendor/autoload.php ]; then
    echo "==> Installing PHP dependencies..."
    composer install --no-interaction --prefer-dist --optimize-autoloader
fi

# Generate APP_KEY if not provided
if [ -z "$APP_KEY" ]; then
    echo "==> APP_KEY not set — generating a temporary one..."
    export APP_KEY="base64:$(php -r 'echo base64_encode(random_bytes(32));')"
fi

# Write a complete .env so Laravel always has DB + app config
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
DB_SSLMODE=${DB_SSLMODE:-prefer}

CACHE_STORE=${CACHE_STORE:-database}
QUEUE_CONNECTION=${QUEUE_CONNECTION:-database}

SANCTUM_STATELESS_DOMAINS=${SANCTUM_STATELESS_DOMAINS:-localhost:5173}
FRONTEND_URL=${FRONTEND_URL:-http://localhost:5173}
EOF

echo "==> Caching Laravel config and routes..."
php artisan config:cache
php artisan route:cache

echo "==> Starting PHP-FPM..."
php-fpm -D -R

# PaaS hosts assign the listen port via $PORT at runtime; default to 8000.
LISTEN_PORT="${PORT:-8000}"
sed -i "s/listen 8000;/listen ${LISTEN_PORT};/" /etc/nginx/http.d/default.conf

echo "==> Starting Nginx on port ${LISTEN_PORT}..."
nginx -g 'daemon off;' &
NGINX_PID=$!

# Run migrations and seeding in background after Nginx is up
(
  echo "==> Waiting for database connection..."
  retries=0
  until php -r "
    try {
      \$conn = getenv('DB_CONNECTION');
      \$host = getenv('DB_HOST');
      \$port = getenv('DB_PORT');
      \$db   = getenv('DB_DATABASE');
      \$user = getenv('DB_USERNAME');
      \$pass = getenv('DB_PASSWORD');
      if (\$conn === 'pgsql') {
        \$dsn = \"pgsql:host=\$host;port=\$port;dbname=\$db;sslmode=require\";
      } else {
        \$dsn = \"mysql:host=\$host;dbname=\$db\";
      }
      new PDO(\$dsn, \$user, \$pass);
      echo 'OK';
    } catch(Exception \$e) { exit(1); }
  " 2>/dev/null | grep -q OK; do
    retries=$((retries + 1))
    if [ $retries -ge 30 ]; then
      echo "  Database not reachable after 60s — skipping migrations."
      exit 0
    fi
    echo "  Waiting for database... ($retries/30)"
    sleep 2
  done

  echo "==> Database ready! Running migrations..."
  php artisan migrate --force
  php artisan db:seed --force --no-interaction
  # LegacyImportSeeder uses MySQL-specific backtick syntax — skip on PostgreSQL
  if [ "${DB_CONNECTION}" != "pgsql" ]; then
    php artisan db:seed --class=LegacyImportSeeder --force --no-interaction
  fi
  echo "==> Setup complete."
) &

wait $NGINX_PID
