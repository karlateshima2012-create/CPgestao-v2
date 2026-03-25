# Guia de Deploy Seguro: Hostinger (MariaDB)

Este guia detalha o processo de deploy da aplicação CPgestao-v2 na Hostinger, utilizando uma arquitetura robusta com o banco de dados nativo **MariaDB**.

---

## 🏗️ 1. Visão Geral da Arquitetura

*   **Frontend (React/Vite):** Hospedado como SPA na raiz ou subpasta.
*   **Backend (Laravel API):** Localizado na pasta `api_backend`, isolado da web direta.
*   **Banco de Dados:** MariaDB (Nativo da Hostinger).

---

## 📦 2. Preparação do Banco de Dados (Hostinger)

1.  Acesse o painel da Hostinger > **Bancos de Dados MySQL**.
2.  Crie um novo banco de dados MariaDB.
3.  Anote as credenciais:
    *   **DB_HOST:** Geralmente `localhost` ou o IP fornecido pela Hostinger.
    *   **DB_DATABASE:** Nome do banco criado.
    *   **DB_USERNAME:** Nome do usuário do banco.
    *   **DB_PASSWORD:** Senha do usuário.

---

## 🎨 3. Deploy Automatizado (GitHub Actions)

O deploy é gerenciado pelo arquivo `.github/workflows/deploy.yml`. 

### Configuração de Secrets no GitHub:
No seu repositório, vá em **Settings > Secrets and variables > Actions** e adicione:
*   `HOSTINGER_PASSWORD`: Sua senha de SSH/FTP.
*   `APP_KEY`: Sua `APP_KEY` do Laravel (pode gerar no PC com `php artisan key:generate --show`).
*   `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` (credenciais criadas no passo anterior).

---

## ⚙️ 4. Fluxo de Funcionamento

1.  O GitHub Actions faz o build do Frontend (`npm run build`).
2.  Instala as dependências do Backend via Composer.
3.  Compacta tudo e envia para a Hostinger via SCP.
4.  O script descompacta no servidor e configura o arquivo `.env` com o driver `mysql` (MariaDB).
5.  O redirecionamento é controlado pelo `.htaccess` na raiz:
    *   `https://seu-dominio/api/*` -> Direciona para o Backend.
    *   Outras rotas -> Direcionam para o Frontend (React).

---

## 🔒 5. Segurança

*   O arquivo `.env` não é versionado e é gerado dinamicamente no servidor.
*   A pasta `api_backend` fica fora do acesso direto, protegida por regras de reescrita.
*   `APP_DEBUG` é mantido como `false` em produção.
