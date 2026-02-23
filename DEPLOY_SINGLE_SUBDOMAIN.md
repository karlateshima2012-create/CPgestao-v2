# Guia de Deploy: Subdomínio Único (cpgestao.creativeprintjp.com)

Este guia configura o **Frontend** na raiz e o **Backend** na pasta `/api`, tudo no mesmo subdomínio.

**Arquitetura de Pastas (Hostinger):**
```text
domains/creativeprintjp.com/public_html/cpgestao/
├── .htaccess            (SPA Routing + Proteção API)
├── assets/              (Do frontend)
├── index.html           (Do frontend)
├── api/                 (Pasta "Ponte" pública)
│   └── .htaccess        (Redireciona para o backend)
└── api_backend/         (Código Laravel - PROTEGIDO)
    ├── app/
    ├── public/
    └── .env
```

---

## 🏗️ 1. Preparação Local

### Frontend (React)
1.  Edite `frontend/.env.production`:
    ```env
    VITE_API_URL=https://cpgestao.creativeprintjp.com/api
    ```
2.  Gere o build: `cd frontend && npm run build`
3.  A pasta `frontent/dist` está pronta.

### Backend (Laravel)
1.  Edite `backend/.env` (apenas para referência, não suba):
    ```env
    APP_URL=https://cpgestao.creativeprintjp.com
    ```
2.  `composer install --no-dev --optimize-autoloader`
3.  Crie um **ZIP** com todo o conteúdo da pasta `backend` (exceto `node_modules` e `.env`).

---

## 🚀 2. Upload e Estrutura (Gerenciador de Arquivos)

Acesse a pasta do subdomínio: `domains/creativeprintjp.com/public_html/cpgestao`

### Passo A: Backend (api_backend)
1.  Crie uma pasta chamada **api_backend**.
2.  Faça upload do ZIP do Laravel dentro dela e extraia.
3.  Crie o arquivo `.env` dentro de `api_backend/` com os dados do banco MySQL da Hostinger.

### Passo B: A "Ponte" (/api)
1.  Na raiz `cpgestao`, crie uma pasta chamada **api**.
2.  Dentro de `api/`, crie um arquivo `.htaccess` com este conteúdo exato:
    ```apache
    <IfModule mod_rewrite.c>
        RewriteEngine On
        RewriteRule ^(.*)$ ../api_backend/public/$1 [L]
    </IfModule>
    ```

### Passo C: Frontend (Raiz)
1.  Na raiz `cpgestao`, faça upload de todo o conteúdo de `frontend/dist/`.
2.  Crie (ou edite) o arquivo `.htaccess` na raiz `cpgestao/` com este conteúdo exato:
    ```apache
    <IfModule mod_rewrite.c>
        RewriteEngine On

        # 1. Ignorar a pasta /api (deixar passar para o Backend)
        RewriteRule ^api(/.*)?$ - [L]

        # 2. Configuração SPA (React Router)
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </IfModule>
    ```

---

## ⚙️ 3. Configurações Finais (SSH ou Rotas)

### Permissões
Dê permissão de escrita para estas pastas:
*   `api_backend/storage` (775)
*   `api_backend/bootstrap/cache` (775)

### Migrar Banco
Se tiver SSH:
```bash
cd domains/creativeprintjp.com/public_html/cpgestao/api_backend
php artisan migrate --force
php artisan config:cache
```

---

## ✅ Checklist de Validação

1.  Aesse `https://cpgestao.creativeprintjp.com` (Deve abrir o Front).
2.  Acesse `https://cpgestao.creativeprintjp.com/api/up` (Deve retornar JSON ou erro do Laravel, não 404).
3.  Tente fazer login.
