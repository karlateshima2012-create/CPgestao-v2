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

O projeto está configurado com **GitHub Actions**. Para que funcione, você deve configurar o seguinte no GitHub (Settings > Secrets and variables > Actions):

- **HOSTINGER_PASSWORD**: `Creative23SSHcp@`

Toda vez que o código for enviado para o `master`, a Hostinger atualizará automaticamente.

## 🛠️ Tecnologias
- **Backend:** Laravel (PHP 8.2+)
- **Frontend:** React + Vite + Tailwind (Node 18+)
- **Banco:** SQLite (Local) / Supabase (Produção pretendida)
- **Hospedagem:** Hostinger (SSH habilitado)
