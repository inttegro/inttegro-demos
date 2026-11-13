FROM composer:2 AS dependencies
WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --no-progress --prefer-dist --no-scripts

FROM php:8.5.12-cli
ENV APP_ENV=production \
    APP_DEBUG=false \
    SESSION_DRIVER=cookie
WORKDIR /app
COPY --from=dependencies /app/vendor ./vendor
COPY . .
RUN mkdir -p storage/framework/cache storage/framework/sessions storage/framework/views storage/logs \
    && chown -R www-data:www-data storage bootstrap/cache
USER www-data
EXPOSE 3007
CMD ["sh", "-c", "exec php artisan serve --host=0.0.0.0 --port=${PORT:-3007}"]
