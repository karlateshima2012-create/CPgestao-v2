# CPGestao v2 - Full-Stack CRM & Fidelidade

Plataforma de CRM e Fidelidade com suporte a multi-tenancy, cartões Premium (VIP) via NFC e terminal de pontuação público.

## Estrutura do Projeto

- `/backend`: API Laravel ligada ao banco de dados MariaDB.
- `/frontend`: Interface React (Vite) consumindo a API Laravel.

## Requisitos

- PHP 8.4+
- Composer
- Node.js & NPM
- MariaDB / MySQL

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
   - Configure as credenciais do MariaDB (Hostinger):
     ```env
     DB_CONNECTION=mysql
     DB_HOST=127.0.0.1
     DB_PORT=3306
     DB_DATABASE=seu_banco
     DB_USERNAME=seu_usuario
     DB_PASSWORD=sua_senha
     ```
4. Execute as migrações:
   ```bash
   php artisan migrate
   ```
5. Inicie o servidor (localmente):
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

## Funcionalidades Principais

- **Multi-tenancy:** Isolamento total de dados por `tenant_id`.
- **Cartões Premium:** Geração automática de números únicos e vínculo com clientes.
- **PIN Seguro:** PINs de lojistas armazenados com Hash.
- **Dashboard KPI:** Métricas essenciais de crescimento e retenção.
- **Deploy Automático:** Pipeline GitHub Actions configurado para Hostinger.
