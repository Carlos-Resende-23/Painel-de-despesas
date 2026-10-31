# Painel de despesas

Painel de despesas desenvolvido com Vite e TypeScript.

As despesas e a meta mensal são salvas no navegador. Também é possível marcar
lançamentos como **recorrentes** (mensal, trimestral ou anual), e o painel
exibe um resumo dos valores recorrentes cadastrados e uma previsão para os
próximos seis meses. O histórico também mostra a evolução dos gastos nos
últimos seis meses e a variação em relação ao mês anterior. A previsão não
altera os gastos realizados: use
**Registrar pagamento** quando uma ocorrência for paga para adicioná-la à
lista sem duplicá-la. Para transferir ou proteger esses dados, use
**Exportar backup** para baixar um arquivo JSON e **Importar backup** para
restaurá-lo. A importação substitui os dados atuais após confirmação; o CSV
continua disponível para exportar despesas para planilhas.

## GitHub Pages

O workflow em `.github/workflows/deploy.yml` compila e publica o site no GitHub
Pages a cada push para `main`. Nas configurações do repositório, selecione
**Settings > Pages > Build and deployment > Source > GitHub Actions**.

Para gerar o site localmente, execute `npm ci` e `npm run build`. Os arquivos
prontos para publicação serão criados em `dist`.
