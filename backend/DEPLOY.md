# Backend Deployment Guide (Laravel 12)

Guia para deploy do backend Laravel utilizando o banco de dados nativo da Hostinger (**MariaDB**).

## Database Connection: MariaDB

Este projeto utiliza o driver MySQL para conectar ao MariaDB.

### `.env` Configuration
Seu arquivo `.env` de produção deve usar o driver `mysql`.

```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1 (ou IP da Hostinger)
DB_PORT=3306
DB_DATABASE=nome_do_banco
DB_USERNAME=usuario_do_banco
DB_PASSWORD=senha_do_banco
```

---

## Key Commands

```bash
# Instalar dependências (produção)
composer install --no-dev --optimize-autoloader

# Rodar migrações
php artisan migrate --force

# Otimizar caches
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## Security Checklist
- [ ] `APP_DEBUG=false` em produção.
- [ ] Arquivo `.env` NÃO está acessível publicamente.
- [ ] Diretórios `storage` e `bootstrap/cache` com permissão de escrita.
