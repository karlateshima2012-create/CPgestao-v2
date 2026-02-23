---
description: Automatiza a preparação do pacote de deploy para o CP Gestão e Fidelidade (Subdomínio Único)
---

# Fluxo de Preparação de Deploy (Single Subdomain)

Este workflow automatiza a criação do pacote ZIP estruturado para subdomínio único.

// turbo-all
1. Limpar e criar estrutura temporária
```bash
rm -rf PACOTE_DEPLOY_CP_GESTAO
mkdir -p PACOTE_DEPLOY_CP_GESTAO/api
mkdir -p PACOTE_DEPLOY_CP_GESTAO/api_backend
```

2. Preparar Frontend (Raiz)
```bash
cd frontend
npm install
npm run build
cp -r dist/* ../PACOTE_DEPLOY_CP_GESTAO/
cd ..
```

3. Criar .htaccess da Raiz
```bash
cat <<EOT > PACOTE_DEPLOY_CP_GESTAO/.htaccess
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^api(/.*)?$ - [L]
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>
EOT
```

4. Criar .htaccess da Pasta api/
```bash
cat <<EOT > PACOTE_DEPLOY_CP_GESTAO/api/.htaccess
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteRule ^(.*)$ ../api_backend/public/\$1 [L]
</IfModule>
EOT
```

5. Preparar Backend (api_backend)
```bash
cd backend
composer install --no-dev --optimize-autoloader
cp -r . ../PACOTE_DEPLOY_CP_GESTAO/api_backend/
# Limpeza de pastas desnecessárias no pacote
rm -rf ../PACOTE_DEPLOY_CP_GESTAO/api_backend/node_modules
rm -rf ../PACOTE_DEPLOY_CP_GESTAO/api_backend/.git
cd ..
```

6. Gerar ZIP Final
```bash
zip -r CP_GESTAO_DEPLOY_COMPLETE.zip PACOTE_DEPLOY_CP_GESTAO
echo "Pacote de deploy gerado com sucesso: \$PWD/CP_GESTAO_DEPLOY_COMPLETE.zip"
```
