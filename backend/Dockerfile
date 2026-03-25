FROM php:8.3-fpm-alpine

# Install system dependencies + PHP extensions
RUN apk add --no-cache \
    git curl zip unzip bash linux-headers \
    libpng-dev libzip-dev icu-dev oniguruma-dev libxml2-dev \
    && docker-php-ext-configure intl \
    && docker-php-ext-install \
        pdo_mysql mbstring exif pcntl bcmath gd zip intl xml

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Copy entrypoint
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
