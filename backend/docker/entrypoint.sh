#!/bin/bash
set -e

echo "==> Starting Fromagerie API..."

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

echo "==> Starting Laravel on port 8000..."
exec php artisan serve --host=0.0.0.0 --port=8000
