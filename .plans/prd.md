# PRD — Painel de Despesas

## 1. Visão geral

Aplicação web para registrar e acompanhar despesas pessoais. O usuário pode cadastrar, editar e excluir lançamentos, consultar totais e distribuição por categoria, filtrar por período, categoria e título, definir uma meta mensal e exportar ou importar seus dados.

**Stack:** Vite + TypeScript (vanilla), HTML e CSS.  
**Persistência:** despesas e meta mensal salvas no `localStorage` do navegador.
**Estado atual do repositório:** aplicação funcional com interface responsiva, formulário de despesas, resumo financeiro, filtros combináveis, operações de edição e exclusão, exportação CSV e backup JSON.

---

## 2. Objetivos

| Objetivo            | Descrição                                                                    |
| ------------------- | ---------------------------------------------------------------------------- |
| Registrar despesas  | Adicionar, editar e excluir despesas com título, valor, data e categoria      |
| Visualizar despesas | Consultar lançamentos e filtrar por mês, categoria e título                   |
| Resumir gastos      | Exibir totais, distribuição por categoria e acompanhamento da meta mensal    |
| Proteger dados      | Persistir dados no navegador e permitir exportar/importar backup              |
| Simplicidade        | Código legível, fácil de manter, sem frameworks ou abstrações desnecessárias |

---

## 3. Requisitos funcionais

### 3.1 Adicionar despesa

| ID    | Requisito                                                                                                                                      | Prioridade |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-01 | O usuário deve preencher **título**, **valor positivo**, **data** e uma **categoria fixa**                                                     | Must       |
| RF-02 | Ao confirmar o envio do formulário, uma nova despesa é criada e adicionada à lista                                                             | Must       |
| RF-03 | Cada despesa recebe um **id** único (`string`) gerado automaticamente                                                                          | Must       |
| RF-04 | Campos inválidos (título vazio, valor ≤ 0 ou não numérico, data vazia ou categoria inválida) impedem o salvamento e exibem feedback acessível | Must       |
| RF-05 | Após adicionar com sucesso, o formulário deve ser limpo para permitir nova entrada                                                             | Should     |

### 3.2 Listar despesas

| ID    | Requisito                                                                                                                                          | Prioridade |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-06 | As despesas correspondentes aos filtros selecionados são exibidas abaixo do formulário                                                       | Must       |
| RF-07 | Cada item exibe **título**, **valor**, **categoria** e **data** formatados                                                                    | Must       |
| RF-08 | Exibe mensagens distintas quando ainda não há despesas e quando os filtros não encontram resultados                                         | Must       |
| RF-09 | A lista é atualizada imediatamente após adicionar, editar, excluir ou alterar filtros                                                       | Must       |
| RF-10 | A busca por título é parcial, sem diferenciar maiúsculas/minúsculas ou acentos                                                              | Must       |
| RF-11 | Os filtros de mês, categoria e título são combinados; os campos de busca e categoria podem ser limpos para remover seus critérios           | Must       |

### 3.3 Resumo financeiro (sidebar)

| ID    | Requisito                                                                      | Prioridade |
| ----- | ------------------------------------------------------------------------------ | ---------- |
| RF-12 | A sidebar exibe a soma e a quantidade das despesas correspondentes aos filtros | Must       |
| RF-13 | A sidebar exibe total por categoria, inclusive **R$ 0,00** para categorias sem despesas | Must |
| RF-14 | O gráfico apresenta a distribuição por categoria das despesas filtradas        | Must       |
| RF-15 | Os totais e o gráfico são recalculados após alterações e mudanças nos filtros  | Must       |
| RF-16 | A meta é comparada com todos os gastos do mês em foco, sem restringir por busca ou categoria | Must |

### 3.4 Gerenciar lançamentos e orçamento

| ID    | Requisito                                                                                 | Prioridade |
| ----- | ----------------------------------------------------------------------------------------- | ---------- |
| RF-17 | O usuário pode editar e excluir uma despesa; editar reutiliza o formulário de lançamento | Must |
| RF-18 | A meta mensal aceita valores maiores ou iguais a zero e é salva no navegador             | Must |
| RF-19 | As categorias são fixas: `alimento`, `transporte`, `lazer`, `saúde`, `outros`             | Must |

### 3.5 Persistência e transferência de dados

| ID    | Requisito                                                                                 | Prioridade |
| ----- | ----------------------------------------------------------------------------------------- | ---------- |
| RF-20 | Despesas e meta mensal persistem entre recargas no mesmo navegador                        | Must |
| RF-21 | A exportação CSV inclui somente as despesas visíveis após aplicação dos filtros           | Must |
| RF-22 | O backup JSON inclui todas as despesas e a meta, independentemente dos filtros ativos     | Must |
| RF-23 | A importação valida formato, versão, campos e ids; pede confirmação antes de substituir os dados | Must |
| RF-24 | Erros de leitura, validação ou armazenamento são comunicados sem substituir dados existentes | Must |

### 3.6 Fora do escopo funcional

- Sincronização entre dispositivos ou armazenamento em nuvem
- Autenticação ou suporte multiusuário
- Categorias personalizadas
- Importação de CSV

---

## 4. Requisitos técnicos

### 4.1 Stack e ferramentas

| ID     | Requisito                                                                                                                                             |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| RT-01  | Build e dev server via **Vite** (já configurado no projeto)                                                                                           |
| RT-02  | Linguagem: **TypeScript** vanilla, sem React, Vue ou outros frameworks                                                                                |
| RT-03  | Estilização via **CSS** em arquivo dedicado (`src/style.css`)                                                                                         |
| RT-04  | **Estrutura HTML completa** da interface (sidebar, formulário, containers de lista e estado vazio) definida em `index.html`                           |
| RT-04a | TypeScript **não monta** o layout inteiro dentro de `#app` (proibido `innerHTML` com a página completa ou criação programática da estrutura estática) |
| RT-04b | TypeScript atualiza dados e conteúdo dinâmico: totais, mensagens de estado vazio, gráfico, opções de mês e itens da lista                    |

### 4.2 Arquitetura de código

| ID     | Requisito                                                                                                                                                     |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RT-05  | Todos os tipos em **`src/types.ts`** (usar `type`, não `interface`)                                                                                           |
| RT-06  | Ponto de entrada da aplicação: **`src/main.ts`**                                                                                                              |
| RT-07  | Event listeners registrados **exclusivamente no TypeScript** — proibido `onclick`, `onchange` ou handlers inline no HTML                                      |
| RT-08  | `index.html` contém o **HTML semântico completo** do app (layout de duas colunas, sidebar, card de formulário, container da lista e mensagem de estado vazio) |
| RT-08a | Elementos que o TypeScript precisa atualizar devem ter **`id`** ou **`data-*`** previsíveis para consulta via `querySelector` / `getElementById`              |
| RT-09  | Código simples, direto e de fácil manutenção — evitar over-engineering, padrões complexos ou camadas desnecessárias                                           |

### 4.3 Modelo de dados

Definir em `src/types.ts`:

```typescript
type Categoria = "alimento" | "transporte" | "lazer" | "saúde" | "outros"

type Despesa = {
  id: string
  titulo: string
  valor: number
  categoria: Categoria
  data?: string
}
```

| ID    | Requisito                                                                                    |
| ----- | -------------------------------------------------------------------------------------------- |
| RT-10 | Estado das despesas: array de `Despesa[]`, sincronizado com `localStorage`                    |
| RT-11 | Geração de `id`: string única por despesa (ex.: `crypto.randomUUID()`)                       |
| RT-12 | Valor armazenado como `number`; formatação monetária apenas na camada de apresentação        |
| RT-13 | Dados lidos do armazenamento ou backup são validados antes de uso                            |

### 4.4 Separação HTML × TypeScript

| Camada         | Responsabilidade                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `index.html`   | Estrutura estática: layout, formulário, sidebar, containers, labels, placeholders, estado vazio     |
| `src/main.ts`  | Estado em memória, validação, eventos, cálculos e **atualização** dos elementos já presentes no DOM |
| `src/types.ts` | Tipos e constantes (ex.: lista de categorias)                                                       |

**Itens dinâmicos da lista:** o container da lista fica no HTML; cada despesa adicionada pode ser inserida como elemento filho (ex.: `<li>` ou `<article>`) criado pelo TypeScript a partir dos dados — sem reconstruir o restante da página.

**Exemplo de estrutura esperada em `index.html` (esboço):**

```html
<div id="app" class="layout">
  <aside class="sidebar">
    <p id="total-geral">R$ 0,00</p>
    <ul id="totais-por-categoria">
      <!-- itens fixos por categoria ou preenchidos via TS -->
    </ul>
  </aside>
  <main class="conteudo">
    <form id="form-despesa">...</form>
    <p id="lista-vazia" hidden>Nenhuma despesa registrada.</p>
    <ul id="lista-despesas"></ul>
  </main>
</div>
```

Os ids e tags acima são ilustrativos; o importante é manter a **estrutura no HTML** e usar o TypeScript só para ler o formulário, manter o array de despesas e refletir mudanças nos nós existentes.

### 4.5 Estrutura de arquivos sugerida

```
index.html           # estrutura semântica completa da interface
src/
├── main.ts          # estado, eventos, validação e atualização do DOM
├── types.ts         # Categoria, Despesa, constantes de categorias
├── style.css        # estilos globais e componentes visuais
└── (opcional)
    ├── dom.ts       # helpers de atualização do DOM (totais, lista), se main.ts crescer demais
    └── state.ts     # array de despesas e funções puras de cálculo
```

A divisão em módulos extras é opcional; priorizar simplicidade. Funções puras recomendadas para cálculos de totais (testáveis e isoladas).

### 4.6 Scripts npm

| Comando           | Uso                                    |
| ----------------- | -------------------------------------- |
| `npm run dev`     | Servidor de desenvolvimento            |
| `npm run build`   | Type-check (`tsc`) + build de produção |
| `npm run preview` | Preview do build                       |

---

## 5. Requisitos visuais e de UX

### 5.1 Layout geral

```
┌─────────────────────────────────────────────────────┐
│  SIDEBAR (esquerda)  │  ÁREA PRINCIPAL (direita)    │
│                      │                              │
│  Total geral         │  ┌─────────────────────────┐ │
│  R$ X.XXX,XX         │  │ Card: Nova despesa      │ │
│                      │  │ [título] [valor] [cat.] │ │
│  Por categoria:      │  │ [botão adicionar]       │ │
│  • alimento    R$ …  │  └─────────────────────────┘ │
│  • transporte  R$ …  │                              │
│  • lazer       R$ …  │  Lista de despesas           │
│  • saúde       R$ …  │  ┌─────────────────────────┐ │
│  • outros      R$ …  │  │ item 1                  │ │
│                      │  │ item 2                  │ │
│                      │  └─────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

| ID    | Requisito                                                                                       | Prioridade |
| ----- | ----------------------------------------------------------------------------------------------- | ---------- |
| RV-01 | Layout em duas colunas: **sidebar fixa à esquerda**, conteúdo principal à direita               | Must       |
| RV-02 | Área principal: **card de adição no topo**, **lista de despesas abaixo**                        | Must       |
| RV-03 | Layout responsivo básico: em telas estreitas, sidebar pode empilhar acima do conteúdo principal | Should     |

### 5.2 Sidebar

| ID    | Requisito                                                                                     | Prioridade |
| ----- | --------------------------------------------------------------------------------------------- | ---------- |
| RV-04 | Destaque visual para o **total geral** (tipografia maior ou cor de ênfase)                    | Should     |
| RV-05 | Lista de totais por categoria com rótulo legível (capitalizar ou traduzir labels se desejado) | Must       |
| RV-06 | Valores monetários formatados em **Real brasileiro** (`R$ 1.234,56`)                          | Should     |

### 5.3 Card de nova despesa

| ID    | Requisito                                                                              | Prioridade |
| ----- | -------------------------------------------------------------------------------------- | ---------- |
| RV-07 | Campos visíveis: input de título, input de valor, select de categoria, botão de submit | Must       |
| RV-08 | Card com borda, padding e fundo distinto do restante da página                         | Should     |
| RV-09 | Labels ou placeholders claros para cada campo                                          | Should     |
| RV-10 | Botão de ação com texto explícito (ex.: "Adicionar despesa")                           | Must       |

### 5.4 Lista de despesas

| ID    | Requisito                                                                        | Prioridade |
| ----- | -------------------------------------------------------------------------------- | ---------- |
| RV-11 | Cada despesa em item/card separado ou linha com separador visual                 | Must       |
| RV-12 | Informações por item: título, valor (destaque), badge ou tag de categoria e data | Must       |
| RV-13 | Estado vazio distingue lista sem despesas de ausência de resultados pelos filtros | Must |
| RV-14 | A lista oferece busca por título e filtro por categoria, além do filtro de mês na sidebar | Must |
| RV-15 | Busca não diferencia maiúsculas/minúsculas nem acentos                              | Must       |

### 5.5 Identidade visual

| ID    | Requisito                                                                    | Prioridade |
| ----- | ---------------------------------------------------------------------------- | ---------- |
| RV-16 | Paleta coerente e legível (contraste adequado para texto e valores)          | Should     |
| RV-17 | Tipografia sem dependência de fontes externas obrigatórias                   | Could      |
| RV-18 | HTML em português brasileiro com título "Painel de Despesas"                 | Should     |

---

## 6. Fluxos principais

### 6.1 Adicionar e gerenciar despesa

1. Usuário preenche título, valor, data e categoria.
2. TypeScript valida os campos e, se válidos, cria ou atualiza a despesa.
3. Os dados são salvos no navegador; a lista, resumo e gráfico são atualizados.
4. Se inválido, o app informa os campos a corrigir sem alterar a despesa.
5. Para editar, usuário carrega a despesa no formulário; para excluir, remove o lançamento da lista.

### 6.2 Filtrar despesas

1. Usuário seleciona um mês na sidebar e, opcionalmente, digita parte do título e/ou escolhe uma categoria.
2. A lista, a contagem, os totais por categoria, o total geral e o gráfico exibem os resultados que atendem a todos os critérios.
3. O CSV exporta apenas esses resultados; o backup permanece completo.
4. Se nenhum lançamento corresponder, o app mostra o estado "Nenhuma despesa encontrada"; se não houver despesas cadastradas, mostra a orientação inicial.

### 6.3 Acompanhar meta mensal

1. Usuário define uma meta mensal na sidebar.
2. A meta é salva no navegador e comparada aos gastos totais do mês em foco, sem ser afetada pelos filtros de título ou categoria.

---

## 7. Critérios de aceite

- [ ] `npm run dev` inicia o app sem erros
- [ ] `npm run build` conclui com sucesso (TypeScript + Vite)
- [ ] Formulário adiciona e edita despesa com id, título, valor, data e categoria válidos
- [ ] Lista permite excluir despesas e persiste alterações no navegador
- [ ] Busca por título parcial não diferencia acentos ou capitalização
- [ ] Filtros de mês, categoria e título podem ser combinados e atualizam lista, contagem e resumo
- [ ] Estado vazio diferencia ausência de despesas de ausência de resultados
- [ ] Sidebar e gráfico mostram valores corretos para o conjunto filtrado
- [ ] Meta mensal persiste e contabiliza os gastos do mês sem filtros de categoria ou título
- [ ] CSV inclui apenas despesas visíveis; backup inclui todos os dados
- [ ] Importação inválida ou cancelada preserva os dados atuais
- [ ] Recarregar a página mantém despesas e meta salvas no navegador
- [ ] Nenhum event handler inline no HTML
- [ ] Estrutura da interface (sidebar, formulário, lista, estado vazio) definida em `index.html`, não montada inteira via TypeScript
- [ ] TypeScript limita-se a estado, validação, eventos e atualização de elementos existentes / itens da lista
- [ ] Tipos definidos em `src/types.ts`
- [ ] Layout: sidebar à esquerda, card + lista e controles de filtro à direita

---

## 8. Referência

Documento de origem: [.plans/brain-dump.md](./brain-dump.md)
