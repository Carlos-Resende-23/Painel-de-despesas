# Painel de despesas

Painel de despesas desenvolvido com Vite e TypeScript.

As despesas e a meta mensal são salvas no navegador. Para transferir ou
proteger esses dados, use **Exportar backup** para baixar um arquivo JSON e
**Importar backup** para restaurá-lo. A importação substitui os dados atuais
após confirmação; o CSV continua disponível para exportar despesas para
planilhas.

## GitHub Pages

O workflow em `.github/workflows/deploy.yml` compila e publica o site no GitHub
Pages a cada push para `main`. Nas configurações do repositório, selecione
**Settings > Pages > Build and deployment > Source > GitHub Actions**.

Para gerar o site localmente, execute `npm ci` e `npm run build`. Os arquivos
prontos para publicação serão criados em `dist`.
