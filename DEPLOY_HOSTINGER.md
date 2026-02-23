# Guia de Deploy Seguro: Hostinger + Supabase (Postgres)

Este guia detalha o processo de deploy da aplicação CPgestao-fidelidade na Hostinger, utilizando uma arquitetura segura com **Frontend Estático** e **Backend API Isolado**, conectando a um banco de dados **Supabase Postgres**.

---

## 🏗️ 1. Visão Geral da Arquitetura

*   **Frontend (React/Vite):** Hospedado como site estático no domínio principal (ex: `cpgestao.seu-dominio.com`).
*   **Backend (Laravel API):** Hospedado em um subdomínio protegido (ex: `api.cpgestao.seu-dominio.com`).
*   **Banco de Dados:** Supabase (PostgreSQL) externo.

---

## 📦 2. Preparação do Banco de Dados (Supabase)

1.  Crie um projeto no [Supabase](https://supabase.com/).
2.  Acesse **Project Settings > Database > Connection pooler**.
3.  Obtenha os dados de conexão (Transaction Mode: `Session` é recomendado para Laravel, ou direcione para a porta 5432 sem pooler se preferir).
4.  **Segurança:** Vá em **Authentication > Providers** e desabilite "Email" se você não for usar o Auth do Supabase no front. A autenticação será feita 100% pelo Laravel Sanctum.

---

## 🎨 3. Deploy do Frontend (React/Vite)

O frontend é uma SPA (Single Page Application) estática.

### Passo 1: Configurar Variáveis de Ambiente
Crie/edite o arquivo `frontend/.env.production` localmente antes do build:

```env
VITE_API_URL=https://api.cpgestao.seu-dominio.com
```

### Passo 2: Gerar o Build
No seu computador, rode:

```bash
cd frontend
npm install
npm run build
```

Isso criará uma pasta `dist/` com `index.html` e assets otimizados.

### Passo 3: Upload para Hostinger
1.  Acesse o **Gerenciador de Arquivos** da Hostinger.
2.  Vá para a pasta `public_html` (ou a pasta do seu subdomínio do front).
3.  Apague qualquer arquivo padrão (`default.php`, etc).
4.  Faça upload de **todo o conteúdo** da pasta `frontend/dist/` para dentro da `public_html`.

### Passo 4: Configurar SPA (.htaccess)
Crie um arquivo `.htaccess` na raiz do frontend (`public_html/.htaccess`) para redirecionar todas as rotas para o `index.html` (essencial para React Router):

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

---

## ⚙️ 4. Deploy do Backend (Laravel API)

O backend ficará em um subdomínio separado para segurança e organização.

### Passo 1: Criar Subdomínio
1.  No painel da Hostinger, crie um subdomínio: `api.cpgestao.seu-dominio.com`.
2.  Isso criará uma pasta `public_html/api` (ou similar).

### Passo 2: Preparar Arquivos (Upload)
1.  No seu computador, prepare o backend (sem `node_modules` e sem `vendor`, se for usar composer no servidor).
    *   *Dica:* Se a Hostinger não tiver SSH/Composer no seu plano, rode `composer install --no-dev --optimize-autoloader` no seu PC e suba a pasta `vendor` completa via ZIP.
2.  Compacte a pasta `backend` inteira (exceto `.env`, `node_modules`, `.git`).
3.  Faça upload do ZIP para a pasta do subdomínio (`public_html/api`).
4.  Descompacte. A estrutura deve ficar algo como:
    *   `public_html/api/app/`
    *   `public_html/api/bootstrap/`
    *   `public_html/api/public/`
    *   ...

### Passo 3: Ajustar DocumentRoot (Crucial!)
O Laravel deve servir apenas a pasta `public/`.
1.  Na Hostinger, a raiz do subdomínio aponta para `public_html/api`. Isso expõe arquivos sensíveis `.env` se não protegido!
2.  **Solução 1 (Painel):** Se possível, mude a "Pasta Raiz" do subdomínio para `public_html/api/public`.
3.  **Solução 2 (.htaccess na raiz da api):** Se não puder mudar a raiz, crie um `.htaccess` em `public_html/api/.htaccess`:

```apache
<IfModule mod_rewrite.c>
   RewriteEngine On
   RewriteRule ^(.*)$ public/$1 [L]
</IfModule>
```

### Passo 4: Configurar .env
Crie um arquivo `.env` na raiz do backend (`public_html/api/.env`) com segredos de produção:

```env
APP_NAME=CPGestao
APP_ENV=production
APP_KEY=base64:...(sua chave gerada com php artisan key:generate)...
APP_DEBUG=false
APP_URL=https://api.cpgestao.seu-dominio.com

# Banco Supabase (Postgres)
DB_CONNECTION=pgsql
DB_HOST=aws-0-sa-east-1.pooler.supabase.com (exemplo)
DB_PORT=6543 (ou 5432)
DB_DATABASE=postgres
DB_USERNAME=postgres.seu-projeto
DB_PASSWORD=sua-senha-do-banco

# CORS (Segurança)
CORS_ALLOWED_ORIGINS=https://cpgestao.seu-dominio.com

# Cache (Recomendado: redis ou file)
CACHE_DRIVER=file
SESSION_DRIVER=file
```

### Passo 5: Instalar Dependências e Migrar
Se tiver acesso SSH:
```bash
cd public_html/api
composer install --no-dev --optimize-autoloader
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan storage:link
```
*Sem SSH:* Suba o `vendor` pronto, e use uma rota temporária no `routes/web.php` para rodar `Artisan::call('migrate')` (apague depois!).

### Passo 6: Permissões
Garanta que as pastas `storage` e `bootstrap/cache` tenham permissão de escrita (775 ou 755).

---

## 🔒 5. Checklist de Pós-Deploy e Segurança

1.  [ ] **Acesso Web:** Tente acessar `https://api.cpgestao.../api/public-terminal/loja-normal`. Deve retornar JSON.
2.  [ ] **Frontend no Ar:** Acesse o front e tente fazer login.
3.  [ ] **Debug Desligado:** Force um erro na API (acesse uma rota inexistente). Deve retornar uma página genérica de erro (404/500) sem mostrar código ("Whoops, looks like something went wrong").
4.  [ ] **HTTPS:** Garanta que o cadeado SSL está ativo no Front e na API.
5.  [ ] **Bloqueio de .env:** Tente acessar `https://api.cpgestao.../.env` pelo navegador. Deve dar erro 403 Forbidden.

---

## 🛠️ Dicas Extras
*   **Rotacionar Senhas:** Se a senha do banco vazar, mude imediatamente no Supabase e atualize o `.env`.
*   **Bloqueio Supabase:** No Painel do Supabase > API Settings, você pode desabilitar a "Anon Key" e "Service Role Key" se não for usar a API REST do Supabase, forçando todo acesso a passar pelo seu Backend Laravel. Isso é ótimo para segurança.
