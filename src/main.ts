import "./style.css"
import { CATEGORIAS, type Categoria, type Despesa } from "./types.ts"

const CHAVE_ARMAZENAMENTO = "painel-despesas:v1"
const CHAVE_META_MENSAL = "painel-despesas:meta-mensal:v1"

function obterDataLocal(data = new Date()): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, "0")
  const dia = String(data.getDate()).padStart(2, "0")
  return `${dia}-${mes}-${ano}`
}

function obterDataParaFormulario(data?: string): string {
  if (!data) return obterDataLocal()
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data

  const dataConvertida = new Date(data)
  return Number.isNaN(dataConvertida.getTime())
    ? obterDataLocal()
    : obterDataLocal(dataConvertida)
}

function ehDespesa(valor: unknown): valor is Despesa {
  if (typeof valor !== "object" || valor === null) return false

  const registro = valor as Record<string, unknown>
  const dataValida =
    typeof registro.data !== "string" ||
    !Number.isNaN(Date.parse(registro.data))

  return (
    typeof registro.id === "string" &&
    typeof registro.titulo === "string" &&
    registro.titulo.trim().length > 0 &&
    typeof registro.valor === "number" &&
    Number.isFinite(registro.valor) &&
    registro.valor > 0 &&
    CATEGORIAS.some((categoria) => categoria === registro.categoria) &&
    dataValida
  )
}

function carregarDespesas(): Despesa[] {
  try {
    const dados = localStorage.getItem(CHAVE_ARMAZENAMENTO)
    if (!dados) return []

    const despesasSalvas: unknown = JSON.parse(dados)

    if (Array.isArray(despesasSalvas)) {
      return despesasSalvas.filter(ehDespesa).map((despesa) => ({
        ...despesa,
        data: despesa.data ?? obterDataLocal(),
      }))
    }

    if (typeof despesasSalvas === "object" && despesasSalvas !== null) {
      const estado = despesasSalvas as { despesas?: unknown[] }
      if (Array.isArray(estado.despesas)) {
        return estado.despesas.filter(ehDespesa).map((despesa) => ({
          ...despesa,
          data: despesa.data ?? obterDataLocal(),
        }))
      }
    }

    return []
  } catch {
    return []
  }
}

function carregarMetaMensal(): number {
  try {
    const dados = localStorage.getItem(CHAVE_META_MENSAL)
    if (!dados) return 0

    const valor = Number(dados)
    return Number.isFinite(valor) && valor >= 0 ? valor : 0
  } catch {
    return 0
  }
}

function salvarMetaMensal(valor: number): boolean {
  try {
    localStorage.setItem(CHAVE_META_MENSAL, String(valor))
    return true
  } catch {
    return false
  }
}

const despesas: Despesa[] = carregarDespesas()

function selecionarElemento<T extends Element>(seletor: string): T {
  const elemento = document.querySelector<T>(seletor)
  if (!elemento) {
    throw new Error(`Elemento obrigatório não encontrado: ${seletor}`)
  }
  return elemento
}

const form = selecionarElemento<HTMLFormElement>("#form-despesa")
const tituloInput = selecionarElemento<HTMLInputElement>("#titulo")
const valorInput = selecionarElemento<HTMLInputElement>("#valor")
const dataInput = selecionarElemento<HTMLInputElement>("#data-despesa")
const categoriaInput = selecionarElemento<HTMLSelectElement>("#categoria")
const mensagemFormulario = selecionarElemento<HTMLParagraphElement>(
  "#mensagem-formulario",
)
const listaDespesas = selecionarElemento<HTMLUListElement>("#lista-despesas")
const listaVazia = selecionarElemento<HTMLParagraphElement>("#lista-vazia")
const totalGeral = selecionarElemento<HTMLParagraphElement>("#total-geral")
const quantidadeDespesas = selecionarElemento<HTMLParagraphElement>(
  "#quantidade-despesas",
)
const contadorLista = selecionarElemento<HTMLSpanElement>("#contador-lista")
const chartCategorias = selecionarElemento<HTMLDivElement>("#grafico-categorias")
const chartCaption = selecionarElemento<HTMLSpanElement>("#chart-caption")
const botaoSubmit = selecionarElemento<HTMLButtonElement>("#submit-despesa")
const botaoCancelarEdicao =
  selecionarElemento<HTMLButtonElement>("#cancelar-edicao")
const inputMetaMensal = selecionarElemento<HTMLInputElement>("#meta-mensal")
const statusMetaMensal = selecionarElemento<HTMLParagraphElement>(
  "#meta-mensal-status",
)
const filtroMes = selecionarElemento<HTMLSelectElement>("#mes-filtro")

let despesaEmEdicaoId: string | null = null

const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

const nomesCategoria: Record<Categoria, string> = {
  alimento: "Alimento",
  transporte: "Transporte",
  lazer: "Lazer",
  saúde: "Saúde",
  outros: "Outros",
}

function obterMesDaData(dataISO?: string): string {
  const data = dataISO ?? obterDataLocal()
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data.slice(0, 7)

  return obterDataLocal(new Date(data)).slice(0, 7)
}

function formatarData(dataISO?: string): string {
  const data = obterDataParaFormulario(dataISO)
  const [ano, mes, dia] = data.split("-").map(Number)
  return new Date(ano, mes - 1, dia).toLocaleDateString("pt-BR")
}

function formatarNomeMes(anoMes: string): string {
  const [ano, mes] = anoMes.split("-").map(Number)
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  })
}

function obterDespesasVisiveis(): Despesa[] {
  if (filtroMes.value === "todos") {
    return [...despesas]
  }

  return despesas.filter(
    (despesa) =>
      obterMesDaData(despesa.data ?? new Date().toISOString()) ===
      filtroMes.value,
  )
}

function atualizarListaMeses(): void {
  const mesesDisponiveis = [
    ...new Set(
      despesas.map((despesa) =>
        obterMesDaData(despesa.data ?? new Date().toISOString()),
      ),
    ),
  ]
    .sort()
    .reverse()

  const opcoes = mesesDisponiveis.map((mes) => {
    const option = document.createElement("option")
    option.value = mes
    option.textContent = formatarNomeMes(mes)
    return option
  })

  const valorAtual = filtroMes.value
  filtroMes.innerHTML = '<option value="todos">Todos os meses</option>'
  opcoes.forEach((option) => filtroMes.append(option))

  if (mesesDisponiveis.includes(valorAtual)) {
    filtroMes.value = valorAtual
  } else {
    filtroMes.value = "todos"
  }
}

function atualizarGraficoCategorias(despesasVisiveis: Despesa[]): void {
  const totais = CATEGORIAS.map((categoria) => ({
    categoria,
    total: despesasVisiveis
      .filter((despesa) => despesa.categoria === categoria)
      .reduce((soma, despesa) => soma + despesa.valor, 0),
  }))

  const maiorTotal = Math.max(...totais.map((item) => item.total), 0)
  const categoriaEmDestaque = totais.reduce(
    (maior, item) => (item.total > maior.total ? item : maior),
    totais[0] ?? { categoria: "alimento", total: 0 },
  )

  chartCategorias.innerHTML = ""

  for (const item of totais) {
    const linha = document.createElement("div")
    linha.className = "chart-row"

    const label = document.createElement("span")
    label.className = "chart-label"
    label.textContent = nomesCategoria[item.categoria]

    const track = document.createElement("div")
    track.className = "chart-track"

    const barra = document.createElement("span")
    barra.className = "chart-bar"
    barra.dataset.chartCategory = item.categoria
    barra.style.width = maiorTotal > 0 ? `${(item.total / maiorTotal) * 100}%` : "0%"
    track.append(barra)

    const valor = document.createElement("strong")
    valor.className = "chart-value"
    valor.textContent = formatadorMoeda.format(item.total)

    linha.append(label, track, valor)
    chartCategorias.append(linha)
  }

  const totalGasto = despesasVisiveis.reduce((soma, despesa) => soma + despesa.valor, 0)

  if (totalGasto > 0 && categoriaEmDestaque.total > 0) {
    const percentual = Math.round(
      (categoriaEmDestaque.total / totalGasto) * 100,
    )
    chartCaption.textContent = `${percentual}% em ${nomesCategoria[categoriaEmDestaque.categoria]}`
  } else {
    chartCaption.textContent = "Sem dados"
  }
}

function atualizarResumo(): void {
  const despesasVisiveis = obterDespesasVisiveis()
  const total = despesasVisiveis.reduce(
    (soma, despesa) => soma + despesa.valor,
    0,
  )
  const metaMensal = Number(inputMetaMensal.value || 0)
  const mesEmFoco =
    filtroMes.value === "todos" ? obterMesDaData() : filtroMes.value

  totalGeral.textContent = formatadorMoeda.format(total)
  quantidadeDespesas.textContent = `${despesasVisiveis.length} ${despesasVisiveis.length === 1 ? "despesa" : "despesas"} ${filtroMes.value === "todos" ? "no total" : `em ${formatarNomeMes(mesEmFoco)}`}`
  contadorLista.textContent = `${despesasVisiveis.length} ${despesasVisiveis.length === 1 ? "item" : "itens"}`

  for (const categoria of CATEGORIAS) {
    const totalCategoria = despesasVisiveis
      .filter((despesa) => despesa.categoria === categoria)
      .reduce((soma, despesa) => soma + despesa.valor, 0)
    const elementoTotal = document.querySelector<HTMLElement>(
      `[data-total-categoria="${categoria}"]`,
    )

    if (elementoTotal) {
      elementoTotal.textContent = formatadorMoeda.format(totalCategoria)
    }
  }

  atualizarGraficoCategorias(despesasVisiveis)

  if (metaMensal > 0) {
    const totalMesMeta = despesas
      .filter(
        (despesa) =>
          obterMesDaData(despesa.data ?? new Date().toISOString()) ===
          mesEmFoco,
      )
      .reduce((soma, despesa) => soma + despesa.valor, 0)

    const restante = metaMensal - totalMesMeta

    if (totalMesMeta <= metaMensal) {
      statusMetaMensal.textContent = `Você já gastou ${formatadorMoeda.format(totalMesMeta)} de ${formatadorMoeda.format(metaMensal)}. Faltam ${formatadorMoeda.format(restante)} para atingir a meta.`
    } else {
      statusMetaMensal.textContent = `Você ultrapassou a meta em ${formatadorMoeda.format(Math.abs(restante))}.`
    }
  } else {
    statusMetaMensal.textContent =
      "Defina uma meta para acompanhar seu orçamento."
  }
}

function salvarDespesas(): boolean {
  try {
    localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(despesas))
    return true
  } catch {
    return false
  }
}

function limparFormulario(): void {
  form.reset()
  dataInput.value = obterDataLocal()
  despesaEmEdicaoId = null
  botaoSubmit.textContent = "Adicionar despesa"
  botaoCancelarEdicao.hidden = true
}

function preencherFormulario(despesa: Despesa): void {
  tituloInput.value = despesa.titulo
  valorInput.value = String(despesa.valor)
  dataInput.value = obterDataParaFormulario(despesa.data)
  categoriaInput.value = despesa.categoria
}

function criarItemDespesa(despesa: Despesa): HTMLLIElement {
  const item = document.createElement("li")
  item.className = "expense-item"
  item.dataset.despesaId = despesa.id

  const detalhes = document.createElement("div")
  detalhes.className = "expense-details"

  const titulo = document.createElement("h3")
  titulo.className = "expense-title"
  titulo.textContent = despesa.titulo

  const categoria = document.createElement("span")
  categoria.className = "category-badge"
  categoria.dataset.category = despesa.categoria
  categoria.textContent = nomesCategoria[despesa.categoria]

  const data = document.createElement("time")
  data.className = "expense-date"
  data.dateTime = obterDataParaFormulario(despesa.data)
  data.textContent = formatarData(despesa.data)

  const valor = document.createElement("p")
  valor.className = "expense-value"
  valor.textContent = formatadorMoeda.format(despesa.valor)

  const acoes = document.createElement("div")
  acoes.className = "expense-actions"

  const botaoEditar = document.createElement("button")
  botaoEditar.className = "expense-edit"
  botaoEditar.type = "button"
  botaoEditar.textContent = "Editar"
  botaoEditar.setAttribute("aria-label", `Editar despesa: ${despesa.titulo}`)
  botaoEditar.addEventListener("click", () => {
    despesaEmEdicaoId = despesa.id
    preencherFormulario(despesa)
    botaoSubmit.textContent = "Salvar alterações"
    botaoCancelarEdicao.hidden = false
    mensagemFormulario.textContent = "Editando despesa."
    tituloInput.focus()
  })

  const botaoExcluir = document.createElement("button")
  botaoExcluir.className = "expense-delete"
  botaoExcluir.type = "button"
  botaoExcluir.textContent = "Excluir"
  botaoExcluir.setAttribute("aria-label", `Excluir despesa: ${despesa.titulo}`)
  botaoExcluir.addEventListener("click", () => {
    const indice = despesas.findIndex(
      (itemAtual) => itemAtual.id === despesa.id,
    )
    if (indice === -1) return

    despesas.splice(indice, 1)

    if (despesaEmEdicaoId === despesa.id) {
      limparFormulario()
    }

    renderizarLista()
    atualizarListaMeses()
    atualizarResumo()
    mensagemFormulario.textContent = salvarDespesas()
      ? "Despesa excluída."
      : "Despesa excluída, mas não foi possível salvar a alteração neste navegador."
  })

  detalhes.append(titulo, categoria, data)
  acoes.append(valor, botaoEditar, botaoExcluir)
  item.append(detalhes, acoes)
  return item
}

function renderizarLista(): void {
  const despesasVisiveis = obterDespesasVisiveis()
  listaDespesas.innerHTML = ""

  for (const despesa of [...despesasVisiveis].reverse()) {
    listaDespesas.append(criarItemDespesa(despesa))
  }

  listaVazia.hidden = despesasVisiveis.length > 0
}

function marcarCampoInvalido(
  campo: HTMLInputElement | HTMLSelectElement,
): void {
  campo.setAttribute("aria-invalid", "true")
}

function limparErros(): void {
  for (const campo of [tituloInput, valorInput, dataInput, categoriaInput]) {
    campo.removeAttribute("aria-invalid")
  }
  mensagemFormulario.textContent = ""
}

form.addEventListener("submit", (evento: SubmitEvent) => {
  evento.preventDefault()
  limparErros()

  const titulo = tituloInput.value.trim()
  const valor = Number(valorInput.value)
  const data = dataInput.value
  const categoriaSelecionada = categoriaInput.value
  const camposInvalidos: Array<HTMLInputElement | HTMLSelectElement> = []

  if (!titulo) camposInvalidos.push(tituloInput)
  if (!Number.isFinite(valor) || valor <= 0) camposInvalidos.push(valorInput)
  if (!data) camposInvalidos.push(dataInput)
  if (!CATEGORIAS.some((categoria) => categoria === categoriaSelecionada)) {
    camposInvalidos.push(categoriaInput)
  }

  if (camposInvalidos.length > 0) {
    camposInvalidos.forEach(marcarCampoInvalido)
    mensagemFormulario.textContent =
      "Preencha título, valor maior que zero, data e categoria."
    camposInvalidos[0].focus()
    return
  }

  const novaDespesa: Despesa = {
    id: crypto.randomUUID(),
    titulo,
    valor,
    categoria: categoriaSelecionada as Categoria,
    data,
  }

  if (despesaEmEdicaoId) {
    const despesa = despesas.find((item) => item.id === despesaEmEdicaoId)

    if (despesa) {
      despesa.titulo = titulo
      despesa.valor = valor
      despesa.categoria = categoriaSelecionada as Categoria
      despesa.data = data
    }
  } else {
    despesas.push(novaDespesa)
  }

  const foiSalva = salvarDespesas()
  atualizarListaMeses()
  renderizarLista()
  atualizarResumo()
  const mensagem = despesaEmEdicaoId
    ? foiSalva
      ? "Despesa atualizada."
      : "Despesa atualizada, mas não foi possível salvar neste navegador."
    : foiSalva
      ? "Despesa adicionada."
      : "Despesa adicionada, mas não foi possível salvar neste navegador."

  limparFormulario()
  mensagemFormulario.textContent = mensagem
  tituloInput.focus()
})

botaoCancelarEdicao.addEventListener("click", () => {
  limparFormulario()
  mensagemFormulario.textContent = "Edição cancelada."
})

filtroMes.addEventListener("change", () => {
  renderizarLista()
  atualizarResumo()
})

inputMetaMensal.addEventListener("input", () => {
  const valorMeta = Number(inputMetaMensal.value)
  const metaValida =
    Number.isFinite(valorMeta) && valorMeta >= 0 ? valorMeta : 0

  salvarMetaMensal(metaValida)
  atualizarResumo()
})

inputMetaMensal.value = String(carregarMetaMensal())

atualizarListaMeses()
renderizarLista()
atualizarResumo()
limparFormulario()
