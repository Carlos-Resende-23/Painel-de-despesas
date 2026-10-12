# Painel de despesas

Painel de despesas desenvolvido com Vite e TypeScript.

## GitHub Pages

O workflow em `.github/workflows/deploy.yml` compila e publica o site no GitHub
Pages a cada push para `main`. Nas configurações do repositório, selecione
**Settings > Pages > Build and deployment > Source > GitHub Actions**.

Para gerar o site localmente, execute `npm ci` e `npm run build`. Os arquivos
prontos para publicação serão criados em `dist`.
