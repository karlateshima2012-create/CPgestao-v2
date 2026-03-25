# Guia de Deploy: Hostinger Premium (MySQL Compartilhado)

Este guia detalha como realizar o deploy do **CPgestao-fidelidade** utilizando exclusivamente os recursos do plano **Hostinger Premium (Shared Hosting)**, sem dependências externas.

---

## 🏗️ 1. Arquitetura de Deploy

*   **Frontend (React):** Arquivos estáticos servidos pelo Apache no domínio principal.
*   **Backend (Laravel):** API servida em subdomínio, conectada ao MySQL local.
*   **Banco de Dados:** MySQL/MariaDB do próprio plano de hospedagem.

---

## 🗄️ 2. Preparação do Banco de Dados (hPanel)

1.  Acesse o **hPanel** da Hostinger.
2.  Vá em **Bancos de Dados > Gerenciamento**.
3.  Crie um novo Banco de Dados MySQL:
    *   **Nome do Banco:** (Ex: `u123456789_cpgestao`)
    *   **Usuário:** (Ex: `u123456789_admin`)
    *   **Senha:** (Crie uma senha forte e ANOTE)
4.  Certifique-se que o Collation é `utf8mb4_unicode_ci`.

---

## ⚙️ 3. Deploy do Backend (API)

O backend ficará em um subdomínio (ex: `api.seudominio.com`).

### Passo 1: Preparação Local
No seu computador, prepare os arquivos para envio:
1.  Entre na pasta do backend: `cd backend`
2.  Instale dependências de produção:
    ```bash
    composer install --no-dev --optimize-autoloader
    ```
3.  Gere um arquivo `.zip` contendo tudo da pasta `backend` **EXCETO**:
    *   `node_modules`
    *   `.env`
    *   `.git`

### Passo 2: Upload e Estrutura
1.  No hPanel, crie o subdomínio `api.seudominio.com`.
2.  No **Gerenciador de Arquivos**, vá para a pasta do subdomínio (ex: `domains/seudominio.com/public_html/api`).
3.  Faça upload do `.zip` e extraia.
4.  **Atenção:** A estrutura deve ser:
    *   `.../api/app`
    *   `.../api/public`
    *   `.../api/vendor`
    *   `(etc)`

### Passo 3: Configurar .env
Crie um arquivo `.env` na raiz da API (`.../api/.env`) com estes valores:

```env
APP_NAME=CPGestao
APP_ENV=production
APP_KEY=  <-- (Copie do seu .env local)
APP_DEBUG=false
APP_URL=https://api.seudominio.com

# LOGS (Importante para shared hosting)
LOG_CHANNEL=daily
LOG_LEVEL=warning

# BANCO DE DADOS (Dados do Passo 2)
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=u123456789_cpgestao
DB_USERNAME=u123456789_admin
DB_PASSWORD=SuaSenhaForteAqui

# CACHE E SESSÃO (Arquivos são mais seguros em shared)
BROADCAST_DRIVER=log
CACHE_DRIVER=file
FILESYSTEM_DISK=local
QUEUE_CONNECTION=sync
SESSION_DRIVER=file
SESSION_LIFETIME=120

# CORS (Permitir seu frontend)
CORS_ALLOWED_ORIGINS=https://seudominio.com
```

### Passo 4: Migração do Banco
Se você tem acesso SSH (Recomendado):
1.  Acesse via SSH.
2.  Navegue até a pasta: `cd domains/seudominio.com/public_html/api`
3.  Rode a migração:
    ```bash
    php artisan migrate --force
    ```
4.  Otimize:
    ```bash
    php artisan config:cache
    php artisan route:cache
    php artisan view:cache
    ```

*Se NÃO tiver SSH:* Crie uma rota temporária em `routes/web.php` para rodar `Artisan::call('migrate --force')` e acesse pelo navegador uma única vez. Apague em seguida.

### Passo 5: Ajuste de Document Root
Para segurança, o Apache deve servir apenas a pasta `public`.
1.  Crie um `.htaccess` na raiz da API (`.../api/.htaccess`):
    ```apache
    <IfModule mod_rewrite.c>
       RewriteEngine On
       RewriteRule ^(.*)$ public/$1 [L]
    </IfModule>
    ```

---

## 🎨 4. Deploy do Frontend (React)

### Passo 1: Build Local
1.  Configure a URL da API em `frontend/.env.production`:
    ```env
    VITE_API_URL=https://api.seudominio.com
    ```
2.  Rode o build:
    ```bash
    cd frontend
    npm run build
    ```

### Passo 2: Upload
1.  Vá para a pasta `frontend/dist`.
2.  Suba todo o conteúdo desta pasta para a **raiz do domínio principal** na Hostinger (`domains/seudominio.com/public_html`).
3.  Certifique-se que o arquivo `.htaccess` (que já está na pasta dist) foi enviado. Ele é essencial para o React funcionar.

---

## ✅ 5. Checklist de Validação

1.  [ ] **Admin:** Acesse /admin/login e faça login.
2.  [ ] **Tenant:** Crie uma nova loja no painel admin.
3.  [ ] **Dispositivos:** Gere um novo lote de cartões.
4.  [ ] **Terminal Público:** Acesse o link público da loja e verifique se carrega.
5.  [ ] **Segurança:** Tente acessar `https://api.seudominio.com/.env` (Deve dar erro 403 Forbidden).

---

**Nota sobre Permissões:**
Garanta que as pastas `storage` e `bootstrap/cache` na API tenham permissão **755** ou **775** (Escrita pelo servidor).
