FROM php:8.3-fpm-alpine

# Install system dependencies + PHP extensions
RUN apk add --no-cache \
    git curl zip unzip bash linux-headers nginx \
    libpng-dev libzip-dev icu-dev oniguruma-dev libxml2-dev \
    && docker-php-ext-configure intl \
    && docker-php-ext-install \
        pdo_mysql mbstring exif pcntl bcmath gd zip intl xml opcache

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# OPcache config
COPY docker/opcache.ini /usr/local/etc/php/conf.d/opcache.ini

# Nginx config
COPY docker/nginx.conf /etc/nginx/http.d/default.conf

# PHP-FPM pool: run as root so it can write to volume-mounted storage on Windows
COPY docker/fpm-pool.conf /usr/local/etc/php-fpm.d/www.conf

# Copy entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
