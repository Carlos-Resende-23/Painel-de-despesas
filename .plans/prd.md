# PRD — Painel de Despesas

## 1. Visão geral

Aplicação web para registrar e visualizar despesas pessoais em tempo real. O usuário adiciona despesas com título, valor e categoria; a interface exibe a lista de despesas e um resumo financeiro na lateral esquerda.

**Stack:** Vite + TypeScript (vanilla), HTML e CSS.  
**Persistência:** nenhuma — os dados existem apenas em memória durante a sessão.  
**Estado atual do repositório:** projeto Vite inicializado; `src/main.ts` vazio; estrutura semântica da interface definida em `index.html`; TypeScript responsável apenas por estado, validação e atualização dos elementos existentes.

---

## 2. Objetivos

| Objetivo            | Descrição                                                                    |
| ------------------- | ---------------------------------------------------------------------------- |
| Registrar despesas  | Permitir adicionar despesas com título, valor e categoria                    |
| Visualizar despesas | Listar todas as despesas adicionadas na sessão                               |
| Resumir gastos      | Exibir total geral e total por categoria na sidebar                          |
| Simplicidade        | Código legível, fácil de manter, sem frameworks ou abstrações desnecessárias |

---

## 3. Requisitos funcionais

### 3.1 Adicionar despesa

| ID    | Requisito                                                                                                                                      | Prioridade |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-01 | O usuário deve preencher **título** (texto), **valor** (número positivo) e **categoria** (seleção entre as categorias fixas)                   | Must       |
| RF-02 | Ao confirmar o envio do formulário, uma nova despesa é criada e adicionada à lista                                                             | Must       |
| RF-03 | Cada despesa recebe um **id** único (`string`) gerado automaticamente                                                                          | Must       |
| RF-04 | Campos inválidos (título vazio, valor ≤ 0 ou não numérico, categoria não selecionada) devem impedir a criação e dar feedback visual ao usuário | Should     |
| RF-05 | Após adicionar com sucesso, o formulário deve ser limpo para permitir nova entrada                                                             | Should     |

### 3.2 Listar despesas

| ID    | Requisito                                                                                                                                          | Prioridade |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| RF-06 | Todas as despesas da sessão são exibidas abaixo do card de adição                                                                                  | Must       |
| RF-07 | Cada item da lista exibe **título**, **valor** formatado como moeda e **categoria**                                                                | Must       |
| RF-08 | Quando não houver despesas, exibe o estado vazio já presente no HTML (mensagem ou placeholder), controlado via TypeScript (`hidden` ou classe CSS) | Should     |
| RF-09 | A lista é atualizada imediatamente após cada adição                                                                                                | Must       |

### 3.3 Resumo financeiro (sidebar)

| ID    | Requisito                                                                      | Prioridade |
| ----- | ------------------------------------------------------------------------------ | ---------- |
| RF-10 | A sidebar exibe a **soma total** de todas as despesas                          | Must       |
| RF-11 | A sidebar exibe o **total por categoria** para cada uma das 5 categorias fixas | Must       |
| RF-12 | Categorias sem despesas exibem total **R$ 0,00** (ou equivalente)              | Must       |
| RF-13 | Os totais são recalculados automaticamente a cada nova despesa adicionada      | Must       |

### 3.4 Categorias

| ID    | Requisito                                                                                 | Prioridade |
| ----- | ----------------------------------------------------------------------------------------- | ---------- |
| RF-14 | As categorias são fixas e imutáveis: `alimento`, `transporte`, `lazer`, `saúde`, `outros` | Must       |
| RF-15 | O usuário seleciona a categoria apenas no momento de adicionar a despesa                  | Must       |

### 3.5 Fora do escopo funcional

- Editar ou excluir despesas
- Filtrar ou ordenar a lista
- Persistência (localStorage, API, banco de dados)
- Autenticação ou multiusuário
- Exportação de dados

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
| RT-04b | TypeScript atualiza apenas **dados e conteúdo dinâmico**: textos de totais, visibilidade do estado vazio, itens da lista de despesas                  |

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
}
```

| ID    | Requisito                                                                                    |
| ----- | -------------------------------------------------------------------------------------------- |
| RT-10 | Estado da aplicação: array de `Despesa[]` mantido em memória                                 |
| RT-11 | Geração de `id`: string única por despesa (ex.: `crypto.randomUUID()` ou timestamp + random) |
| RT-12 | Valor armazenado como `number`; formatação monetária apenas na camada de apresentação        |

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
| RV-12 | Informações por item: título, valor (destaque), badge ou tag de categoria        | Must       |
| RV-13 | Estado vazio amigável definido no HTML; visível apenas quando a lista está vazia | Should     |

### 5.5 Identidade visual

| ID    | Requisito                                                                                                   | Prioridade |
| ----- | ----------------------------------------------------------------------------------------------------------- | ---------- |
| RV-14 | Paleta coerente e legível (contraste adequado para texto e valores)                                         | Should     |
| RV-15 | Tipografia system-ui ou similar, sem dependência de fontes externas obrigatórias                            | Could      |
| RV-16 | Atualizar `<title>` e `lang` do HTML para refletir o app (ex.: `lang="pt-BR"`, título "Painel de Despesas") | Should     |

---

## 6. Fluxos principais

### 6.1 Adicionar despesa

1. Usuário preenche título, valor e categoria no card.
2. Usuário clica em "Adicionar".
3. TypeScript valida os dados.
4. Se válido: cria `Despesa`, adiciona ao array, atualiza textos da sidebar, insere item na lista (e oculta estado vazio), limpa formulário.
5. Se inválido: exibe feedback (borda vermelha, mensagem ou alerta) sem alterar a lista.

### 6.2 Visualizar resumo

1. Ao carregar a página, valores iniciais já estão no HTML (ex.: `R$ 0,00`); o TypeScript pode sincronizar na inicialização se necessário.
2. A cada despesa adicionada, totais são recalculados e os nós correspondentes da sidebar são atualizados (`textContent` ou equivalente).

---

## 7. Critérios de aceite

- [ ] `npm run dev` inicia o app sem erros
- [ ] `npm run build` conclui com sucesso (TypeScript + Vite)
- [ ] Formulário adiciona despesa com id, título, valor e categoria válidos
- [ ] Lista exibe todas as despesas da sessão
- [ ] Sidebar mostra total geral correto
- [ ] Sidebar mostra total correto para cada uma das 5 categorias
- [ ] Recarregar a página zera os dados (sem persistência)
- [ ] Nenhum event handler inline no HTML
- [ ] Estrutura da interface (sidebar, formulário, lista, estado vazio) definida em `index.html`, não montada inteira via TypeScript
- [ ] TypeScript limita-se a estado, validação, eventos e atualização de elementos existentes / itens da lista
- [ ] Tipos definidos em `src/types.ts`
- [ ] Layout: sidebar à esquerda, card + lista à direita

---

## 8. Referência

Documento de origem: [.plans/brain-dump.md](./brain-dump.md)
