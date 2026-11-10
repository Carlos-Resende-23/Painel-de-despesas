# Painel de despesas

Painel de despesas desenvolvido com Vite e TypeScript.

As despesas e a meta mensal são salvas no navegador. Também é possível marcar
lançamentos com a forma de pagamento (Pix, crédito, débito ou dinheiro) e
filtrar e comparar os totais por método. Também é possível marcar lançamentos
como **recorrentes** (mensal, trimestral ou anual), e o painel
exibe um resumo dos valores recorrentes cadastrados e uma previsão para os
próximos seis meses. O histórico também mostra a evolução dos gastos nos
últimos seis meses e a variação em relação ao mês anterior. A previsão não
altera os gastos realizados: use
**Registrar pagamento** quando uma ocorrência for paga para adicioná-la à
lista sem duplicá-la. Use **Repetir** em um lançamento para copiar seus dados
ao formulário com a data de hoje e criar uma nova despesa após revisar e
salvar. Você também pode definir **limites mensais por
categoria**; o painel acompanha o progresso no mês selecionado e sinaliza
quando o limite está próximo ou foi ultrapassado. Para transferir ou proteger esses dados, use
**Exportar backup** para baixar um arquivo JSON e **Importar backup** para
restaurá-lo. O backup inclui despesas, meta mensal e limites por categoria; a
importação substitui os dados atuais após confirmação. Backups antigos sem
limites por categoria continuam compatíveis. Se os dados de despesas no
navegador estiverem inválidos ou inacessíveis, o painel bloqueia alterações e
exportações para evitar sobrescrevê-los; quando possível, permite exportar o
conteúdo bruto para recuperação. Importe um backup válido para retomar o uso
normal. O CSV continua disponível para
exportar despesas para planilhas. Também é possível importar CSV com prévia:
linhas válidas são adicionadas, duplicatas são ignoradas e linhas inválidas
são informadas antes da confirmação. O importador aceita CSV separado por
ponto e vírgula ou vírgula, com colunas de título, valor, categoria e data;
forma de pagamento é opcional. Na lista, é possível ordenar por data (mais
recentes ou mais antigos) ou por valor (maior ou menor); a exportação CSV
respeita os filtros e a ordenação selecionados.

## GitHub Pages

O workflow em `.github/workflows/deploy.yml` compila e publica o site no GitHub
Pages a cada push para `main`. Nas configurações do repositório, selecione
**Settings > Pages > Build and deployment > Source > GitHub Actions**.

Para gerar o site localmente, execute `npm ci` e `npm run build`. Os arquivos
prontos para publicação serão criados em `dist`.

Para executar os testes automatizados de cálculos, recorrências, importação CSV
e backups, use
`npm test`. O workflow do GitHub Pages executa esses testes antes de compilar e
publicar o site.
