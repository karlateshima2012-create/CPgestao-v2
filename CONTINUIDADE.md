# CP Gestão - Guia de Continuidade (Recuperação)

Este arquivo serve para garantir que o projeto seja restaurado corretamente em qualquer computador.

## 📦 Recuperando o Projeto (Novo PC)

1. **Clone o repositório:**
   ```bash
   git clone git@github.com:karlateshima2012-create/CPgestao-v2.git
   ```

2. **Configure as chaves SSH:**
   - Garanta que sua chave `id_ed25519` enviada para o GitHub esteja na pasta `~/.ssh/`.
   - Adicione o Hostinger nos conhecidos: `ssh-keyscan -p 65002 46.202.186.144 >> ~/.ssh/known_hosts`.

3. **Arquivos Críticos (NÃO ESTÃO NO GITHUB):**
   - Você precisa criar manualmente os arquivos `.env` no **backend** e no **frontend**.
   - **Banco de Dados:** O arquivo `backend/database/database.sqlite` contém os dados atuais. Certifique-se de copiá-lo do PC antigo para o novo.

## 🚀 Deploy Automático

O projeto está configurado com **GitHub Actions**. Para que funcione, você deve configurar as seguintes **Secrets** no GitHub (Settings > Secrets and variables > Actions):

1.  **Hospedagem:**
    - `HOSTINGER_PASSWORD`: Sua senha de SSH/FTP (Ex: `Creative23SSHcp@`).
2.  **Aplicação:**
    - `APP_KEY`: Chave do Laravel (Gere com `php artisan key:generate --show`).
3.  **Banco de Dados (MariaDB):**
    - `DB_HOST`: Host do banco (Geralmente `localhost` ou IP da Hostinger).
    - `DB_DATABASE`: Nome do banco de dados criado.
    - `DB_USERNAME`: Usuário do banco de dados.
    - `DB_PASSWORD`: Senha do banco de dados.
4.  **Opcional:**
    - `TELEGRAM_BOT_TOKEN`: Token do bot para notificações.

Toda vez que o código for enviado (push) para o `master`, o deploy será realizado automaticamente para `https://cpgestao.creativeprintjp.com`.

## 🛠️ Tecnologias
- **Backend:** Laravel (PHP 8.2+)
- **Frontend:** React + Vite + Tailwind (Node 18+)
- **Banco:** SQLite (Local) / Supabase (Produção pretendida)
- **Hospedagem:** Hostinger (SSH habilitado)
