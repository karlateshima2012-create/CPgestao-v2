# CPgestao-fidelidadeV1 - Full-Stack CRM

Este projeto é uma plataforma de CRM e Fidelidade com suporte a multi-tenancy, cartões Premium (VIP) via NFC e terminal de pontuação público.

## Estrutura do Projeto

- `/backend`: API Laravel ligada ao Supabase (Postgres).
- `/frontend`: Interface React (Vite) consumindo a API Laravel.

## Requisitos

- PHP 8.2+
- Composer
- Node.js & NPM
- Conta no Supabase (PostgreSQL)

## Configuração do Backend (Laravel)

1. Entre na pasta do backend:
   ```bash
   cd backend
   ```
2. Instale as dependências:
   ```bash
   composer install
   ```
3. Configure o arquivo `.env`:
   - Copie o `.env.example` para `.env`.
   - Configure as credenciais do Supabase (fornecidas no terminal):
     ```env
     DB_CONNECTION=pgsql
     DB_HOST=db.qxhvuqwvoeegvhycncuy.supabase.co
     DB_PORT=5432
     DB_DATABASE=postgres
     DB_USERNAME=postgres
     DB_PASSWORD=SUA_SENHA_AQUI
     ```
4. Execute as migrações e o seeder:
   ```bash
   php artisan migrate:fresh --seed
   ```
5. Inicie o servidor:
   ```bash
   php artisan serve
   ```

## Configuração do Frontend (React)

1. Entre na pasta do frontend:
   ```bash
   cd frontend
   ```
2. Instale as dependências:
   ```bash
   npm install
   ```
3. Inicie o ambiente de desenvolvimento:
   ```bash
   npm run dev
   ```

## Credenciais de Teste (Seeded)

- **Admin Master (Super Admin):**
  - Email: `admin@creativeprint.com`
  - Senha: `admin123`
- **Loja Teste (Client):**
  - Email: `dono@loja.com`
  - Senha: `loja123`
- **PIN da Loja Teste:** `1234`

## Uso do Terminal Público

O terminal é dinâmico e resolve a loja e o dispositivo via URL:
`http://localhost:5173/terminal/loja-teste/UID-DISPOSITIVO`

Para testes, você pode usar os links de "Acesso Rápido" na tela de login ou acessar diretamente via parâmetros de busca se não tiver configurado o roteamento de caminhos:
`http://localhost:5173/?slug=loja-teste&uid=1234567812345678`

## Funcionalidades Implementadas

- **Multi-tenancy:** Isolamento total de dados por `tenant_id`.
- **Cartões Premium:** Geração automática de números únicos (Algoritmo de Luhn) e vínculo com clientes.
- **PIN Seguro:** PINs de lojistas armazenados com Hash (Bcrypt/Argon).
- **Dashboard KPI:** 6 métricas essenciais para o lojista.
- **Integração Real:** Frontend consome dados via base API Axios com interceptores de token.
