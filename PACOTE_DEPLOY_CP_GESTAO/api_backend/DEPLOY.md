# Backend Deployment Guide (Laravel 12)

This guide covers the deployment of the Laravel backend API.

## Database Connection: Supabase (PostgreSQL)

This project connects to a Supabase Postgres database.

### `.env` Configuration
Your production `.env` file must use the `pgsql` driver.

```env
DB_CONNECTION=pgsql
DB_HOST=aws-0-sa-east-1.pooler.supabase.com
DB_PORT=6543
DB_DATABASE=postgres
DB_USERNAME=postgres.seu-projeto
DB_PASSWORD=sua-senha-do-banco
```

**Important:**
- Use the **Transaction Pooler** (Session mode) connection string from Supabase Settings > Database > Connection pooler.
- Port is usually **6543** for the pooler or **5432** for direct connection.
- Ensure `DB_CONNECTION` is strictly `pgsql`.

## Key Commands

```bash
# Install dependencies (production)
composer install --no-dev --optimize-autoloader

# Run migrations
php artisan migrate --force

# Seed database (only for first deploy if needed)
# php artisan db:seed --class=DatabaseSeeder

# Optimize caches
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## Security Checklist
- [ ] `APP_DEBUG=false` in production.
- [ ] `.env` file is NOT accessible publicly.
- [ ] Storage directory is writable.
