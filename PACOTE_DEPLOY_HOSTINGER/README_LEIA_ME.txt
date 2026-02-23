# PACOTE DE DEPLOY - CP Gestão Fidelidade

Este pacote contém tudo pronto para o deploy na Hostinger.

## 📂 Conteúdo:
A pasta `cpgestao` contém exatamente o que deve ser enviado para:
`domains/creativeprintjp.com/public_html/cpgestao`

Ela contém:
1.  **Arquivos do Frontend** (index.html, assets, .htaccess principal)
2.  **`api/`** (A ponte de redirecionamento para o backend)
3.  **`api_backend/`** (O código fonte do Laravel)

## 🚀 Como subir (Upload):

1.  Acesse o **Gerenciador de Arquivos** da Hostinger.
2.  Navegue até `domains/creativeprintjp.com/public_html/`.
3.  Se já existir uma pasta `cpgestao`, renomeie para backup (ex: `cpgestao_old`).
4.  Arraste a pasta `cpgestao` deste pacote para dentro do Gerenciador de Arquivos.
    *   *Alternativa:* Se for muito lenta, zipe a pasta `cpgestao`, faça upload do ZIP e extraia lá dentro.

## ⚙️ Pós-Upload (Configuração Final):

1.  **Banco de Dados (.env):**
    *   Vá em `cpgestao/api_backend/`
    *   Renomeie o arquivo `.env.example` para `.env`
    *   **Edite o .env** e coloque a senha do seu banco de dados MySQL da Hostinger.

2.  **Permissões:**
    *   Clique com botão direito em `cpgestao/api_backend/storage` -> Permissões -> 775 (Marque escrita).
    *   Faça o mesmo em `cpgestao/api_backend/bootstrap/cache`.

3.  **Migrar Banco (Se precisar):**
    *   Como subimos os arquivos sem SSH, o banco pode estar vazio.
    *   Siga o passo "Migração sem SSH" do guia `DEPLOY_SINGLE_SUBDOMAIN.md` se precisar criar as tabelas.

Pronto! Acesse: https://cpgestao.creativeprintjp.com
