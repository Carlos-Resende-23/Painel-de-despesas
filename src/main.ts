import "./style.css"
import {
  analisarImportacaoCsv,
  calcularOcorrenciasPrevistas,
  criarBackupExportado,
  ehBackup,
  interpretarDespesasArmazenadas,
  ordenarDespesas,
  salvarBackupImportado,
  somarDespesas,
  somarValores,
  type OcorrenciaPrevista,
} from "./domain.ts"
import {
  CATEGORIAS,
  FORMAS_PAGAMENTO,
  ORDENACOES_DESPESAS,
  type Categoria,
  type Despesa,
  type FormaPagamento,
  type FrequenciaRecorrencia,
  type LimitesCategoria,
} from "./types.ts"

const CHAVE_ARMAZENAMENTO = "painel-despesas:v1"
const CHAVE_META_MENSAL = "painel-despesas:meta-mensal:v1"
const CHAVE_LIMITES_CATEGORIA = "painel-despesas:limites-categoria:v1"

function obterDataISOlocal(data = new Date()): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, "0")
  const dia = String(data.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

function obterDataParaFormulario(data?: string): string {
  if (!data) return obterDataISOlocal()
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data

  const dataBrasileira = /^(\d{2})-(\d{2})-(\d{4})$/.exec(data)
  if (dataBrasileira) {
    return `${dataBrasileira[3]}-${dataBrasileira[2]}-${dataBrasileira[1]}`
  }

  const dataConvertida = new Date(data)
  return Number.isNaN(dataConvertida.getTime())
    ? obterDataISOlocal()
    : obterDataISOlocal(dataConvertida)
}

type EstadoCarregamentoDespesas = {
  despesas: Despesa[]
  dadosBrutos: string | null
  erro: "corrompido" | "indisponivel" | null
}

function carregarDespesas(): EstadoCarregamentoDespesas {
  try {
    const dados = localStorage.getItem(CHAVE_ARMAZENAMENTO)
    const resultado = interpretarDespesasArmazenadas(dados)
    return {
      despesas: resultado.despesas.map((despesa) => ({
        ...despesa,
        data: obterDataParaFormulario(despesa.data),
      })),
      dadosBrutos: dados,
      erro: resultado.corrompido ? "corrompido" : null,
    }
  } catch {
    return { despesas: [], dadosBrutos: null, erro: "indisponivel" }
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

function ehLimitesCategoria(valor: unknown): valor is LimitesCategoria {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    return false
  }

  return Object.entries(valor).every(
    ([categoria, limite]) =>
      CATEGORIAS.some((item) => item === categoria) &&
      typeof limite === "number" &&
      Number.isFinite(limite) &&
      limite > 0,
  )
}

function carregarLimitesCategoria(): LimitesCategoria {
  try {
    const dados = localStorage.getItem(CHAVE_LIMITES_CATEGORIA)
    if (!dados) return {}

    const limites: unknown = JSON.parse(dados)
    return ehLimitesCategoria(limites) ? limites : {}
  } catch {
    return {}
  }
}

function salvarLimitesCategoria(limites: LimitesCategoria): boolean {
  try {
    localStorage.setItem(CHAVE_LIMITES_CATEGORIA, JSON.stringify(limites))
    return true
  } catch {
    return false
  }
}

const estadoCarregamentoDespesas = carregarDespesas()
const despesas: Despesa[] = estadoCarregamentoDespesas.despesas
let despesasBloqueadas = estadoCarregamentoDespesas.erro !== null
let dadosDespesasBrutos = estadoCarregamentoDespesas.dadosBrutos
let erroCarregamentoDespesas = estadoCarregamentoDespesas.erro
let limitesCategoria: LimitesCategoria = carregarLimitesCategoria()

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
const formaPagamentoInput = selecionarElemento<HTMLSelectElement>(
  "#forma-pagamento",
)
const mensagemFormulario = selecionarElemento<HTMLParagraphElement>(
  "#mensagem-formulario",
)
const listaDespesas = selecionarElemento<HTMLUListElement>("#lista-despesas")
const listaVazia = selecionarElemento<HTMLParagraphElement>("#lista-vazia")
const botaoExportar = selecionarElemento<HTMLButtonElement>(
  "#exportar-despesas",
)
const botaoExportarBackup =
  selecionarElemento<HTMLButtonElement>("#exportar-backup")
const botaoImportarBackup =
  selecionarElemento<HTMLButtonElement>("#importar-backup")
const arquivoBackup = selecionarElemento<HTMLInputElement>("#arquivo-backup")
const botaoImportarCsv =
  selecionarElemento<HTMLButtonElement>("#importar-csv")
const arquivoCsv = selecionarElemento<HTMLInputElement>("#arquivo-csv")
const dialogImportarCsv =
  selecionarElemento<HTMLDialogElement>("#dialog-importar-csv")
const resumoImportacaoCsv = selecionarElemento<HTMLParagraphElement>(
  "#csv-resumo-importacao",
)
const problemasImportacaoCsv = selecionarElemento<HTMLUListElement>(
  "#csv-problemas-importacao",
)
const botaoConfirmarImportacaoCsv = selecionarElemento<HTMLButtonElement>(
  "#confirmar-importacao-csv",
)
const botaoCancelarImportacaoCsv = selecionarElemento<HTMLButtonElement>(
  "#cancelar-importacao-csv",
)
const statusBackup =
  selecionarElemento<HTMLParagraphElement>("#backup-status")
const avisoArmazenamento = selecionarElemento<HTMLDivElement>(
  "#aviso-armazenamento",
)
const avisoArmazenamentoTexto = selecionarElemento<HTMLParagraphElement>(
  "#aviso-armazenamento-texto",
)
const botaoExportarDadosBrutos = selecionarElemento<HTMLButtonElement>(
  "#exportar-dados-brutos",
)
const totalGeral = selecionarElemento<HTMLParagraphElement>("#total-geral")
const quantidadeDespesas = selecionarElemento<HTMLParagraphElement>(
  "#quantidade-despesas",
)
const contadorLista = selecionarElemento<HTMLSpanElement>("#contador-lista")
const alertasFinanceiros = selecionarElemento<HTMLUListElement>(
  "#alertas-financeiros",
)
const chartCategorias = selecionarElemento<HTMLDivElement>("#grafico-categorias")
const chartCaption = selecionarElemento<HTMLSpanElement>("#chart-caption")
const listaLimitesCategoria = selecionarElemento<HTMLDivElement>(
  "#orcamentos-categoria",
)
const statusLimitesCategoria = selecionarElemento<HTMLParagraphElement>(
  "#orcamentos-status",
)
const botaoSubmit = selecionarElemento<HTMLButtonElement>("#submit-despesa")
const botaoCancelarEdicao =
  selecionarElemento<HTMLButtonElement>("#cancelar-edicao")
const inputMetaMensal = selecionarElemento<HTMLInputElement>("#meta-mensal")
const statusMetaMensal = selecionarElemento<HTMLParagraphElement>(
  "#meta-mensal-status",
)
const progressoMetaMensal = selecionarElemento<HTMLDivElement>(
  "#meta-mensal-progresso",
)
const barraMetaMensal = selecionarElemento<HTMLDivElement>(
  "#meta-mensal-barra",
)
const preenchimentoMetaMensal = selecionarElemento<HTMLSpanElement>(
  "#meta-mensal-preenchimento",
)
const percentualMetaMensal = selecionarElemento<HTMLSpanElement>(
  "#meta-mensal-percentual",
)
const checkboxDespesaRecorrente = selecionarElemento<HTMLInputElement>(
  "#despesa-recorrente",
)
const frequenciaRecorrencia = selecionarElemento<HTMLSelectElement>(
  "#frequencia-recorrencia",
)
const statusRecorrentes = selecionarElemento<HTMLParagraphElement>(
  "#recorrentes-status",
)
const filtroMes = selecionarElemento<HTMLSelectElement>("#mes-filtro")
const filtroTexto = selecionarElemento<HTMLInputElement>("#filtro-texto")
const filtroCategoria =
  selecionarElemento<HTMLSelectElement>("#filtro-categoria")
const filtroPagamento =
  selecionarElemento<HTMLSelectElement>("#filtro-pagamento")
const ordenacaoLista =
  selecionarElemento<HTMLSelectElement>("#ordenacao-despesas")
const totaisPorPagamento = selecionarElemento<HTMLUListElement>(
  "#totais-por-pagamento",
)
const tituloListaVazia = selecionarElemento<HTMLSpanElement>(
  "#lista-vazia-titulo",
)
const descricaoListaVazia = selecionarElemento<HTMLSpanElement>(
  "#lista-vazia-descricao",
)
const previsaoTotal = selecionarElemento<HTMLElement>("#previsao-total")
const previsaoLista = selecionarElemento<HTMLDivElement>("#previsao-lista")
const previsaoVazia = selecionarElemento<HTMLParagraphElement>("#previsao-vazia")
const previsaoStatus = selecionarElemento<HTMLParagraphElement>(
  "#previsao-status",
)
const graficoEvolucao = selecionarElemento<HTMLDivElement>("#grafico-evolucao")
const comparacaoEvolucao =
  selecionarElemento<HTMLParagraphElement>("#trend-comparison")

let despesaEmEdicaoId: string | null = null
let importacaoCsvPendente: ReturnType<typeof analisarImportacaoCsv> | null =
  null

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

const nomesFormaPagamento: Record<FormaPagamento, string> = {
  pix: "Pix",
  credito: "Crédito",
  debito: "Débito",
  dinheiro: "Dinheiro",
}

function obterNomeFrequencia(frequencia?: string): string {
  switch (frequencia) {
    case "trimestral":
      return "Trimestral"
    case "anual":
      return "Anual"
    default:
      return "Mensal"
  }
}

function obterMesDaData(dataISO?: string): string {
  const data = dataISO ?? obterDataISOlocal()
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data.slice(0, 7)

  const dataBrasileira = /^(\d{2})-(\d{2})-(\d{4})$/.exec(data)
  if (dataBrasileira) return `${dataBrasileira[3]}-${dataBrasileira[2]}`

  const dataConvertida = new Date(data)
  return Number.isNaN(dataConvertida.getTime())
    ? obterDataISOlocal().slice(0, 7)
    : obterDataISOlocal(dataConvertida).slice(0, 7)
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

function obterOcorrenciasPrevistas(): OcorrenciaPrevista[] {
  return calcularOcorrenciasPrevistas(despesas)
}

function registrarOcorrencia(
  despesa: Despesa,
  data: string,
): void {
  if (despesasBloqueadas) return

  const ocorrenciasAnteriores = despesa.ocorrenciasRegistradas
  despesa.ocorrenciasRegistradas = [...(ocorrenciasAnteriores ?? []), data]
  despesas.push({
    id: crypto.randomUUID(),
    titulo: despesa.titulo,
    valor: despesa.valor,
    categoria: despesa.categoria,
    formaPagamento: despesa.formaPagamento,
    data,
    recorrente: false,
  })

  if (!salvarDespesas()) {
    despesas.pop()
    if (ocorrenciasAnteriores) {
      despesa.ocorrenciasRegistradas = ocorrenciasAnteriores
    } else {
      delete despesa.ocorrenciasRegistradas
    }
    previsaoStatus.textContent =
      "Não foi possível registrar a ocorrência. Os dados não foram alterados."
    return
  }

  atualizarListaMeses()
  renderizarLista()
  atualizarResumo()
  previsaoStatus.textContent =
    `${despesa.titulo} registrada em ${formatarData(data)}.`
}

function renderizarPrevisao(): void {
  const ocorrencias = obterOcorrenciasPrevistas()
  const total = somarValores(ocorrencias.map(({ despesa }) => despesa.valor))
  previsaoTotal.textContent = formatadorMoeda.format(total)
  previsaoLista.innerHTML = ""
  previsaoVazia.hidden = ocorrencias.length > 0

  const ocorrenciasPorMes = new Map<string, OcorrenciaPrevista[]>()
  for (const ocorrencia of ocorrencias) {
    const mes = ocorrencia.data.slice(0, 7)
    const grupo = ocorrenciasPorMes.get(mes) ?? []
    grupo.push(ocorrencia)
    ocorrenciasPorMes.set(mes, grupo)
  }

  for (const [mes, itens] of ocorrenciasPorMes) {
    const grupo = document.createElement("section")
    grupo.className = "forecast-month"
    grupo.setAttribute("aria-label", formatarNomeMes(mes))

    const cabecalhoMes = document.createElement("div")
    cabecalhoMes.className = "forecast-month-header"

    const tituloMes = document.createElement("h3")
    tituloMes.className = "forecast-month-title"
    tituloMes.textContent = formatarNomeMes(mes)

    const totalMes = document.createElement("strong")
    totalMes.className = "forecast-month-total"
    totalMes.textContent = formatadorMoeda.format(
      somarValores(itens.map(({ despesa }) => despesa.valor)),
    )
    cabecalhoMes.append(tituloMes, totalMes)
    grupo.append(cabecalhoMes)

    for (const ocorrencia of itens) {
      const linha = document.createElement("div")
      linha.className = "forecast-item"

      const detalhes = document.createElement("div")
      detalhes.className = "forecast-details"

      const titulo = document.createElement("strong")
      titulo.className = "forecast-item-title"
      titulo.textContent = ocorrencia.despesa.titulo

      const info = document.createElement("span")
      info.className = "forecast-item-info"
      info.textContent =
        `${formatarData(ocorrencia.data)} · ${nomesCategoria[ocorrencia.despesa.categoria]}`

      const valor = document.createElement("span")
      valor.className = "forecast-item-value"
      valor.textContent = formatadorMoeda.format(ocorrencia.despesa.valor)

      const botaoRegistrar = document.createElement("button")
      botaoRegistrar.className = "forecast-register"
      botaoRegistrar.type = "button"
      botaoRegistrar.disabled = despesasBloqueadas
      botaoRegistrar.textContent = "Registrar pagamento"
      botaoRegistrar.setAttribute(
        "aria-label",
        `Registrar ${ocorrencia.despesa.titulo} de ${formatadorMoeda.format(ocorrencia.despesa.valor)} em ${formatarData(ocorrencia.data)}`,
      )
      botaoRegistrar.addEventListener("click", () => {
        registrarOcorrencia(ocorrencia.despesa, ocorrencia.data)
      })

      detalhes.append(titulo, info)
      linha.append(detalhes, valor, botaoRegistrar)
      grupo.append(linha)
    }

    previsaoLista.append(grupo)
  }
}

function obterDespesasVisiveis(): Despesa[] {
  const textoBusca = filtroTexto.value
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

  return despesas.filter((despesa) => {
    const tituloNormalizado = despesa.titulo
      .toLocaleLowerCase("pt-BR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
    const correspondeAoMes =
      filtroMes.value === "todos" ||
      obterMesDaData(despesa.data ?? new Date().toISOString()) ===
        filtroMes.value
    const correspondeACategoria =
      filtroCategoria.value === "todas" ||
      despesa.categoria === filtroCategoria.value
    const correspondeAoPagamento =
      filtroPagamento.value === "todas" ||
      (filtroPagamento.value === "nao-informado"
        ? !despesa.formaPagamento
        : despesa.formaPagamento === filtroPagamento.value)

    return (
      correspondeAoMes &&
      correspondeACategoria &&
      correspondeAoPagamento &&
      tituloNormalizado.includes(textoBusca)
    )
  })
}

function obterDespesasOrdenadas(): Despesa[] {
  const ordenacao =
    ORDENACOES_DESPESAS.find((item) => item === ordenacaoLista.value) ??
    "recentes"
  return ordenarDespesas(obterDespesasVisiveis(), ordenacao)
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
    total: somarDespesas(despesasVisiveis, { categoria }),
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

  const totalGasto = somarValores(despesasVisiveis.map(({ valor }) => valor))

  if (totalGasto > 0 && categoriaEmDestaque.total > 0) {
    const percentual = Math.round(
      (categoriaEmDestaque.total / totalGasto) * 100,
    )
    chartCaption.textContent = `${percentual}% em ${nomesCategoria[categoriaEmDestaque.categoria]}`
  } else {
    chartCaption.textContent = "Sem dados"
  }
}

function atualizarGraficoEvolucao(): void {
  const hoje = new Date()
  const meses = Array.from({ length: 6 }, (_, indice) => {
    const data = new Date(hoje.getFullYear(), hoje.getMonth() - 5 + indice, 1)
    return {
      data,
      chave: obterDataISOlocal(data).slice(0, 7),
      total: 0,
    }
  })
  const totaisPorMes = new Map(meses.map((mes) => [mes.chave, mes]))

  for (const despesa of despesas) {
    const mes = totaisPorMes.get(obterMesDaData(despesa.data))
    if (mes) mes.total = somarValores([mes.total, despesa.valor])
  }

  const maiorTotal = Math.max(...meses.map((mes) => mes.total), 0)
  graficoEvolucao.innerHTML = ""

  for (const [indice, mes] of meses.entries()) {
    const linha = document.createElement("div")
    linha.className = "trend-row"
    linha.setAttribute("role", "listitem")
    linha.setAttribute(
      "aria-label",
      `${formatarNomeMes(mes.chave)}: ${formatadorMoeda.format(mes.total)}`,
    )

    const rotulo = document.createElement("span")
    rotulo.className = "trend-label"
    rotulo.textContent =
      `${mes.data.toLocaleDateString("pt-BR", { month: "short" }).replace(/\.$/, "")}/${String(mes.data.getFullYear()).slice(-2)}`

    const trilha = document.createElement("div")
    trilha.className = "trend-track"
    trilha.setAttribute("aria-hidden", "true")

    const barra = document.createElement("span")
    barra.className = "trend-bar"
    barra.style.width =
      maiorTotal > 0 ? `${(mes.total / maiorTotal) * 100}%` : "0%"
    if (indice === meses.length - 1) barra.classList.add("is-current")
    trilha.append(barra)

    const valor = document.createElement("strong")
    valor.className = "trend-value"
    valor.textContent = formatadorMoeda.format(mes.total)

    linha.append(rotulo, trilha, valor)
    graficoEvolucao.append(linha)
  }

  const mesAtual = meses[meses.length - 1]
  const mesAnterior = meses[meses.length - 2]
  if (!mesAtual || !mesAnterior) return

  const nomeMesAnterior = formatarNomeMes(mesAnterior.chave)
  if (mesAtual.total === mesAnterior.total) {
    comparacaoEvolucao.textContent =
      mesAtual.total === 0
        ? "Sem gastos registrados nos dois últimos meses."
        : `Mesmo valor de ${nomeMesAnterior}.`
    return
  }

  if (mesAnterior.total === 0) {
    comparacaoEvolucao.textContent =
      `Sem gastos em ${nomeMesAnterior}; ${formatadorMoeda.format(mesAtual.total)} no mês atual.`
    return
  }

  const diferenca = Math.abs(mesAtual.total - mesAnterior.total)
  const percentual = Number(((diferenca / mesAnterior.total) * 100).toFixed(1))
  const direcao = mesAtual.total > mesAnterior.total ? "Aumento" : "Queda"
  const detalhePercentual = percentual > 0 ? ` (${percentual}%)` : ""
  comparacaoEvolucao.textContent =
    `${direcao} de ${formatadorMoeda.format(diferenca)}${detalhePercentual} em relação a ${nomeMesAnterior}.`
}

function inicializarLimitesCategoria(): void {
  for (const categoria of CATEGORIAS) {
    const item = document.createElement("div")
    item.className = "category-budget"

    const cabecalho = document.createElement("div")
    cabecalho.className = "category-budget-header"

    const nome = document.createElement("label")
    nome.className = "category-budget-name"
    nome.htmlFor = `limite-${categoria}`
    nome.textContent = nomesCategoria[categoria]

    const valorInput = document.createElement("input")
    valorInput.id = `limite-${categoria}`
    valorInput.className = "category-budget-input"
    valorInput.type = "number"
    valorInput.min = "0"
    valorInput.step = "0.01"
    valorInput.inputMode = "decimal"
    valorInput.placeholder = "Sem limite"
    valorInput.dataset.categoria = categoria
    valorInput.setAttribute(
      "aria-label",
      `Limite mensal para ${nomesCategoria[categoria]} em reais`,
    )
    valorInput.value = String(limitesCategoria[categoria] ?? "")
    cabecalho.append(nome, valorInput)

    const progressoLinha = document.createElement("div")
    progressoLinha.className = "category-budget-progress-row"
    progressoLinha.dataset.progressoCategoria = categoria

    const barra = document.createElement("div")
    barra.className = "category-budget-progress"
    barra.setAttribute("role", "progressbar")
    barra.setAttribute("aria-label", `Uso do limite de ${nomesCategoria[categoria]}`)
    barra.setAttribute("aria-valuemin", "0")
    barra.setAttribute("aria-valuemax", "100")
    barra.setAttribute("aria-valuenow", "0")

    const preenchimento = document.createElement("span")
    preenchimento.className = "category-budget-progress-fill"
    barra.append(preenchimento)

    const percentual = document.createElement("span")
    percentual.className = "category-budget-percent"
    progressoLinha.append(barra, percentual)

    const status = document.createElement("p")
    status.className = "category-budget-status"
    status.dataset.statusCategoria = categoria

    item.append(cabecalho, progressoLinha, status)
    listaLimitesCategoria.append(item)
  }
}

function atualizarLimitesCategoria(mes: string): void {
  for (const categoria of CATEGORIAS) {
    const total = somarDespesas(despesas, { mes, categoria })
    const limite = limitesCategoria[categoria] ?? 0
    const input = listaLimitesCategoria.querySelector<HTMLInputElement>(
      `[data-categoria="${categoria}"]`,
    )
    const progressoLinha = listaLimitesCategoria.querySelector<HTMLDivElement>(
      `[data-progresso-categoria="${categoria}"]`,
    )
    const barra = progressoLinha?.querySelector<HTMLDivElement>(
      ".category-budget-progress",
    )
    const preenchimento = progressoLinha?.querySelector<HTMLSpanElement>(
      ".category-budget-progress-fill",
    )
    const percentualElemento =
      progressoLinha?.querySelector<HTMLSpanElement>(
        ".category-budget-percent",
      )
    const status = listaLimitesCategoria.querySelector<HTMLParagraphElement>(
      `[data-status-categoria="${categoria}"]`,
    )

    if (input && document.activeElement !== input) {
      input.value = limite > 0 ? String(limite) : ""
    }

    if (
      !progressoLinha ||
      !barra ||
      !preenchimento ||
      !percentualElemento ||
      !status
    ) {
      continue
    }

    if (limite <= 0) {
      progressoLinha.hidden = true
      barra.setAttribute("aria-valuenow", "0")
      preenchimento.style.width = "0%"
      barra.classList.remove("is-near", "is-over")
      status.textContent = "Defina um limite mensal."
      status.classList.remove("is-near", "is-over")
      continue
    }

    const percentualPreciso = (total / limite) * 100
    const percentual = Math.round(percentualPreciso)
    progressoLinha.hidden = false
    preenchimento.style.width = `${Math.min(percentualPreciso, 100)}%`
    percentualElemento.textContent = `${percentual}%`
    barra.setAttribute(
      "aria-valuenow",
      String(Math.min(percentual, 100)),
    )
    barra.setAttribute(
      "aria-valuetext",
      `${percentual}% do limite utilizado`,
    )
    barra.classList.toggle(
      "is-near",
      percentualPreciso >= 80 && percentualPreciso < 100,
    )
    barra.classList.toggle("is-over", percentualPreciso >= 100)
    status.classList.toggle(
      "is-near",
      percentualPreciso >= 80 && percentualPreciso < 100,
    )
    status.classList.toggle("is-over", percentualPreciso >= 100)

    if (total > limite) {
      status.textContent =
        `Limite ultrapassado em ${formatadorMoeda.format(total - limite)}.`
    } else if (total === limite) {
      status.textContent = "Limite atingido."
    } else {
      status.textContent =
        `${formatadorMoeda.format(total)} de ${formatadorMoeda.format(limite)} · restam ${formatadorMoeda.format(limite - total)}.`
    }
  }
}

function atualizarAlertas(): void {
  const mesEmFoco =
    filtroMes.value === "todos" ? obterMesDaData() : filtroMes.value
  const despesasMes = despesas.filter(
    (despesa) =>
      obterMesDaData(despesa.data ?? new Date().toISOString()) === mesEmFoco,
  )
  const totalMes = somarValores(despesasMes.map(({ valor }) => valor))
  const metaMensal = Number(inputMetaMensal.value || 0)
  const hoje = new Date()
  const mesAtual = obterDataISOlocal().slice(0, 7)
  const alertas: Array<{ nivel: "alerta" | "warning" | "sucesso"; titulo: string; texto: string }> = []

  if (metaMensal > 0) {
    const restante = metaMensal - totalMes
    if (mesEmFoco === mesAtual) {
      const ultimoDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
      const diasRestantes = Math.max(ultimoDiaDoMes.getDate() - hoje.getDate(), 1)
      const gastoDiario = totalMes / Math.max(hoje.getDate(), 1)
      const projecao = gastoDiario * ultimoDiaDoMes.getDate()

      if (totalMes <= metaMensal) {
        const gastoMaximoPorDia = restante / diasRestantes
        alertas.push({
          nivel: restante <= metaMensal * 0.15 ? "warning" : "sucesso",
          titulo: "Meta em andamento",
          texto: `Faltam ${formatadorMoeda.format(restante)} para atingir a meta. Para manter o orçamento, você pode gastar até ${formatadorMoeda.format(gastoMaximoPorDia)} por dia nos próximos ${diasRestantes} dias.`,
        })
      } else {
        alertas.push({
          nivel: "alerta",
          titulo: "Meta em risco",
          texto: `Você ultrapassou a meta em ${formatadorMoeda.format(Math.abs(restante))}. Se mantiver este ritmo, poderá fechar o mês em ${formatadorMoeda.format(projecao)}.`,
        })
      }
    } else {
      if (totalMes <= metaMensal) {
        alertas.push({
          nivel: "sucesso",
          titulo: "Meta do mês",
          texto: `${formatarNomeMes(mesEmFoco)} fechou com ${formatadorMoeda.format(totalMes)} de ${formatadorMoeda.format(metaMensal)}.`,
        })
      } else {
        alertas.push({
          nivel: "alerta",
          titulo: "Meta do mês",
          texto: `${formatarNomeMes(mesEmFoco)} excedeu a meta em ${formatadorMoeda.format(Math.abs(metaMensal - totalMes))}.`,
        })
      }
    }
  }

  for (const categoria of CATEGORIAS) {
    const limite = limitesCategoria[categoria] ?? 0
    if (limite <= 0) continue

    const totalCategoria = somarDespesas(despesasMes, { categoria })
    const percentual = (totalCategoria / limite) * 100

    if (percentual >= 100) {
      alertas.push({
        nivel: "alerta",
        titulo: `${nomesCategoria[categoria]} ultrapassou o limite`,
        texto: `Você gastou ${formatadorMoeda.format(totalCategoria)} de ${formatadorMoeda.format(limite)} neste mês.`,
      })
      break
    }

    if (percentual >= 80) {
      alertas.push({
        nivel: "warning",
        titulo: `${nomesCategoria[categoria]} perto do limite`,
        texto: `Já usou ${Math.round(percentual)}% do limite mensal de ${formatadorMoeda.format(limite)}.`,
      })
    }
  }

  const recorrentesPrevistos = somarValores(
    obterOcorrenciasPrevistas().map(({ despesa }) => despesa.valor),
  )
  if (recorrentesPrevistos > 0) {
    alertas.push({
      nivel: "sucesso",
      titulo: "Próximos 6 meses",
      texto: `Há ${formatadorMoeda.format(recorrentesPrevistos)} em despesas recorrentes previstas.`,
    })
  }

  alertasFinanceiros.innerHTML = ""

  if (alertas.length === 0) {
    const item = document.createElement("li")
    item.className = "insight-item insight-sucesso"
    const texto = document.createElement("span")
    texto.textContent = "Tudo em ordem por enquanto. Continue acompanhando o mês."
    item.append(texto)
    alertasFinanceiros.append(item)
    return
  }

  for (const alerta of alertas.slice(0, 3)) {
    const item = document.createElement("li")
    item.className = `insight-item insight-${alerta.nivel}`

    const icone = document.createElement("span")
    icone.className = "insight-icon"
    icone.textContent = alerta.nivel === "alerta" ? "!" : alerta.nivel === "warning" ? "•" : "✓"

    const conteudo = document.createElement("div")
    conteudo.className = "insight-content"

    const titulo = document.createElement("strong")
    titulo.textContent = alerta.titulo

    const texto = document.createElement("span")
    texto.textContent = alerta.texto

    conteudo.append(titulo, texto)
    item.append(icone, conteudo)
    alertasFinanceiros.append(item)
  }
}

function atualizarResumo(): void {
  const despesasVisiveis = obterDespesasVisiveis()
  const total = somarValores(despesasVisiveis.map(({ valor }) => valor))
  const metaMensal = Number(inputMetaMensal.value || 0)
  const mesEmFoco =
    filtroMes.value === "todos" ? obterMesDaData() : filtroMes.value
  const despesasRecorrentes = despesas.filter((despesa) => despesa.recorrente)
  const totalRecorrente = somarValores(
    despesasRecorrentes.map(({ valor }) => valor),
  )

  totalGeral.textContent = formatadorMoeda.format(total)
  quantidadeDespesas.textContent = `${despesasVisiveis.length} ${despesasVisiveis.length === 1 ? "despesa" : "despesas"} ${filtroMes.value === "todos" ? "no total" : `em ${formatarNomeMes(mesEmFoco)}`}`
  contadorLista.textContent = `${despesasVisiveis.length} ${despesasVisiveis.length === 1 ? "item" : "itens"}`

  if (despesasRecorrentes.length === 0) {
    statusRecorrentes.textContent = "Nenhuma despesa recorrente cadastrada."
  } else {
    statusRecorrentes.textContent = `${despesasRecorrentes.length} ${despesasRecorrentes.length === 1 ? "recorrente" : "recorrentes"} · ${formatadorMoeda.format(totalRecorrente)}`
  }

  for (const categoria of CATEGORIAS) {
    const totalCategoria = somarDespesas(despesasVisiveis, { categoria })
    const elementoTotal = document.querySelector<HTMLElement>(
      `[data-total-categoria="${categoria}"]`,
    )

    if (elementoTotal) {
      elementoTotal.textContent = formatadorMoeda.format(totalCategoria)
    }
  }

  totaisPorPagamento.innerHTML = ""
  for (const forma of FORMAS_PAGAMENTO) {
    const totalPagamento = somarValores(
      despesasVisiveis
        .filter((despesa) => despesa.formaPagamento === forma)
        .map(({ valor }) => valor),
    )
    const item = document.createElement("li")
    item.className = "category-total"

    const nome = document.createElement("span")
    nome.className = "category-label"
    nome.textContent = nomesFormaPagamento[forma]

    const total = document.createElement("span")
    total.textContent = formatadorMoeda.format(totalPagamento)
    item.append(nome, total)
    totaisPorPagamento.append(item)
  }

  const totalNaoInformado = somarValores(
    despesasVisiveis
      .filter((despesa) => !despesa.formaPagamento)
      .map(({ valor }) => valor),
  )
  if (totalNaoInformado > 0) {
    const item = document.createElement("li")
    item.className = "category-total"

    const nome = document.createElement("span")
    nome.className = "category-label"
    nome.textContent = "Não informado"

    const total = document.createElement("span")
    total.textContent = formatadorMoeda.format(totalNaoInformado)
    item.append(nome, total)
    totaisPorPagamento.append(item)
  }

  atualizarGraficoCategorias(despesasVisiveis)
  atualizarGraficoEvolucao()
  atualizarLimitesCategoria(mesEmFoco)
  atualizarAlertas()

  if (metaMensal > 0) {
    const totalMesMeta = somarDespesas(despesas, { mes: mesEmFoco })

    const restante = metaMensal - totalMesMeta
    const percentual = Math.round((totalMesMeta / metaMensal) * 100)
    const percentualVisual = Math.min(percentual, 100)

    progressoMetaMensal.hidden = false
    preenchimentoMetaMensal.style.width = `${percentualVisual}%`
    percentualMetaMensal.textContent = `${percentual}%`
    barraMetaMensal.setAttribute("aria-valuenow", String(percentualVisual))
    barraMetaMensal.setAttribute(
      "aria-valuetext",
      `${percentual}% da meta mensal utilizado`,
    )
    barraMetaMensal.classList.toggle(
      "is-near",
      percentual >= 80 && percentual < 100,
    )
    barraMetaMensal.classList.toggle("is-over", percentual >= 100)

    if (totalMesMeta <= metaMensal) {
      statusMetaMensal.textContent = `Você já gastou ${formatadorMoeda.format(totalMesMeta)} de ${formatadorMoeda.format(metaMensal)}. Faltam ${formatadorMoeda.format(restante)} para atingir a meta.`
    } else {
      statusMetaMensal.textContent = `Você ultrapassou a meta em ${formatadorMoeda.format(Math.abs(restante))}.`
    }
  } else {
    progressoMetaMensal.hidden = true
    preenchimentoMetaMensal.style.width = "0%"
    percentualMetaMensal.textContent = "0%"
    barraMetaMensal.setAttribute("aria-valuenow", "0")
    barraMetaMensal.setAttribute("aria-valuetext", "0% da meta mensal utilizado")
    barraMetaMensal.classList.remove("is-near", "is-over")
    statusMetaMensal.textContent =
      "Defina uma meta para acompanhar seu orçamento."
  }
}

function salvarDespesas(): boolean {
  if (despesasBloqueadas) return false

  try {
    localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(despesas))
    return true
  } catch {
    return false
  }
}

function atualizarVisibilidadeRecorrencia(): void {
  const recorrente = checkboxDespesaRecorrente.checked
  frequenciaRecorrencia.hidden = !recorrente
  frequenciaRecorrencia.disabled = !recorrente
}

function limparFormulario(): void {
  form.reset()
  dataInput.value = obterDataISOlocal()
  checkboxDespesaRecorrente.checked = false
  frequenciaRecorrencia.value = "mensal"
  formaPagamentoInput.value = ""
  atualizarVisibilidadeRecorrencia()
  despesaEmEdicaoId = null
  botaoSubmit.textContent = "Adicionar despesa"
  botaoCancelarEdicao.hidden = true
}

function preencherFormulario(despesa: Despesa): void {
  tituloInput.value = despesa.titulo
  valorInput.value = String(despesa.valor)
  dataInput.value = obterDataParaFormulario(despesa.data)
  categoriaInput.value = despesa.categoria
  formaPagamentoInput.value = despesa.formaPagamento ?? ""
  checkboxDespesaRecorrente.checked = Boolean(despesa.recorrente)
  frequenciaRecorrencia.value = despesa.frequencia ?? "mensal"
  atualizarVisibilidadeRecorrencia()
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

  const recorrencia = document.createElement("span")
  recorrencia.className = "recurrence-badge"
  recorrencia.textContent = despesa.recorrente
    ? `Recorrente · ${obterNomeFrequencia(despesa.frequencia)}`
    : "Única"

  const pagamento = document.createElement("span")
  pagamento.className = "recurrence-badge"
  pagamento.textContent = despesa.formaPagamento
    ? nomesFormaPagamento[despesa.formaPagamento]
    : "Não informado"

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
  botaoEditar.disabled = despesasBloqueadas
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
  botaoExcluir.disabled = despesasBloqueadas
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

  detalhes.append(titulo, categoria, pagamento, recorrencia, data)
  acoes.append(valor, botaoEditar, botaoExcluir)
  item.append(detalhes, acoes)
  return item
}

function renderizarLista(): void {
  const despesasVisiveis = obterDespesasOrdenadas()
  renderizarPrevisao()
  listaDespesas.innerHTML = ""
  botaoExportar.disabled = despesasBloqueadas || despesasVisiveis.length === 0

  for (const despesa of despesasVisiveis) {
    listaDespesas.append(criarItemDespesa(despesa))
  }

  const listaSemResultados = despesasVisiveis.length === 0
  listaVazia.hidden = !listaSemResultados

  if (listaSemResultados && despesas.length > 0) {
    tituloListaVazia.textContent = "Nenhuma despesa encontrada"
    descricaoListaVazia.textContent =
      "Ajuste os filtros para ver outros lançamentos."
  } else {
    tituloListaVazia.textContent = "Nada por aqui ainda"
    descricaoListaVazia.textContent =
      "As despesas que você adicionar vão aparecer nesta lista."
  }
}

function exportarDespesasVisiveis(): void {
  if (despesasBloqueadas) return

  const linhas = [
    ["Título", "Valor", "Categoria", "Forma de pagamento", "Data"],
    ...obterDespesasOrdenadas().map((despesa) => [
      despesa.titulo,
      despesa.valor.toFixed(2).replace(".", ","),
      nomesCategoria[despesa.categoria],
      despesa.formaPagamento
        ? nomesFormaPagamento[despesa.formaPagamento]
        : "Não informado",
      formatarData(despesa.data),
    ]),
  ]
  const conteudo = linhas
    .map((linha) =>
      linha.map((valor) => `"${valor.replaceAll('"', '""')}"`).join(";"),
    )
    .join("\r\n")
  const arquivo = new Blob(["\uFEFF", conteudo], {
    type: "text/csv;charset=utf-8",
  })
  const url = URL.createObjectURL(arquivo)
  const link = document.createElement("a")
  link.href = url
  link.download =
    filtroMes.value === "todos"
      ? "despesas-todos-os-meses.csv"
      : `despesas-${filtroMes.value}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

async function prepararImportacaoCsv(arquivo: File): Promise<void> {
  if (despesasBloqueadas) return

  if (arquivo.size > 5 * 1024 * 1024) {
    statusBackup.textContent = "O arquivo CSV excede o limite de 5 MB."
    return
  }

  let conteudo: string
  try {
    conteudo = await arquivo.text()
  } catch {
    statusBackup.textContent = "Não foi possível ler o arquivo CSV."
    return
  }

  const resultado = analisarImportacaoCsv(conteudo, despesas)
  importacaoCsvPendente = resultado
  const validas = resultado.validas.length
  const duplicadas = resultado.duplicadas.length
  const invalidas = resultado.invalidas.length
  resumoImportacaoCsv.textContent =
    `${validas} ${validas === 1 ? "despesa válida" : "despesas válidas"} para importar; ` +
    `${duplicadas} ${duplicadas === 1 ? "duplicada será ignorada" : "duplicadas serão ignoradas"}; ` +
    `${invalidas} ${invalidas === 1 ? "linha inválida" : "linhas inválidas"}.`

  problemasImportacaoCsv.replaceChildren()
  const problemas = [...resultado.duplicadas, ...resultado.invalidas].sort(
    (a, b) => a.linha - b.linha,
  )
  for (const problema of problemas.slice(0, 12)) {
    const item = document.createElement("li")
    item.textContent = `Linha ${problema.linha}: ${problema.motivo}`
    problemasImportacaoCsv.append(item)
  }
  if (problemas.length > 12) {
    const item = document.createElement("li")
    item.textContent = `Mais ${problemas.length - 12} linhas não exibidas.`
    problemasImportacaoCsv.append(item)
  }

  botaoConfirmarImportacaoCsv.disabled = validas === 0
  statusBackup.textContent = ""
  dialogImportarCsv.showModal()
}

function confirmarImportacaoCsv(): void {
  if (despesasBloqueadas) return

  const resultado = importacaoCsvPendente
  if (!resultado || resultado.validas.length === 0) return

  const novasDespesas = resultado.validas.map(({ despesa }) => ({
    id: crypto.randomUUID(),
    ...despesa,
  }))
  despesas.push(...novasDespesas)

  if (!salvarDespesas()) {
    despesas.splice(despesas.length - novasDespesas.length, novasDespesas.length)
    statusBackup.textContent =
      "Não foi possível salvar as despesas importadas. Os dados atuais foram preservados."
    dialogImportarCsv.close()
    return
  }

  atualizarListaMeses()
  renderizarLista()
  atualizarResumo()
  statusBackup.textContent = `${novasDespesas.length} ${novasDespesas.length === 1 ? "despesa importada" : "despesas importadas"} com sucesso.`
  dialogImportarCsv.close()
}

function exportarBackup(): void {
  if (despesasBloqueadas) return

  const backup = criarBackupExportado(
    despesas,
    Number(inputMetaMensal.value || 0),
    limitesCategoria,
  )
  const arquivo = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json;charset=utf-8",
  })
  const url = URL.createObjectURL(arquivo)
  const link = document.createElement("a")
  link.href = url
  link.download = `backup-despesas-${obterDataISOlocal()}.json`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
  statusBackup.textContent = "Backup exportado."
}

async function importarBackup(arquivo: File): Promise<void> {
  if (arquivo.size > 5 * 1024 * 1024) {
    statusBackup.textContent = "O arquivo de backup excede o limite de 5 MB."
    return
  }

  let backup: unknown
  try {
    backup = JSON.parse(await arquivo.text())
  } catch {
    statusBackup.textContent = "Não foi possível ler o arquivo JSON."
    return
  }

  if (!ehBackup(backup)) {
    statusBackup.textContent =
      "Arquivo inválido ou incompatível. Selecione um backup JSON deste painel."
    return
  }

  const quantidadeAtual = `${despesas.length} ${despesas.length === 1 ? "despesa atual" : "despesas atuais"}`
  const quantidadeBackup = `${backup.despesas.length} ${backup.despesas.length === 1 ? "despesa" : "despesas"}`
  const confirmou = window.confirm(
    `Este backup substituirá ${quantidadeAtual} por ${quantidadeBackup} e atualizará a meta mensal e os limites por categoria. Deseja continuar?`,
  )
  if (!confirmou) {
    statusBackup.textContent = "Importação cancelada."
    return
  }

  const resultado = salvarBackupImportado(
    localStorage,
    {
      despesas: CHAVE_ARMAZENAMENTO,
      metaMensal: CHAVE_META_MENSAL,
      limitesCategoria: CHAVE_LIMITES_CATEGORIA,
    },
    backup,
  )
  if (resultado !== "salvo") {
    statusBackup.textContent =
      resultado === "falhou"
        ? "Não foi possível salvar o backup. Os dados atuais foram preservados."
        : "Falha ao salvar e restaurar os dados anteriores. Verifique o armazenamento do navegador."
    return
  }

  despesas.splice(0, despesas.length)
  backup.despesas.forEach((despesa) => despesas.push({ ...despesa }))
  despesasBloqueadas = false
  dadosDespesasBrutos = null
  erroCarregamentoDespesas = null
  atualizarAvisoArmazenamento()
  inputMetaMensal.value = String(backup.metaMensal)
  limitesCategoria = { ...(backup.limitesCategoria ?? {}) }
  limparFormulario()
  atualizarListaMeses()
  renderizarLista()
  atualizarResumo()
  statusBackup.textContent = `Backup importado com sucesso: ${backup.despesas.length} ${backup.despesas.length === 1 ? "despesa" : "despesas"}.`
}

function marcarCampoInvalido(
  campo: HTMLInputElement | HTMLSelectElement,
): void {
  campo.setAttribute("aria-invalid", "true")
}

function limparErros(): void {
  for (const campo of [
    tituloInput,
    valorInput,
    dataInput,
    categoriaInput,
    formaPagamentoInput,
  ]) {
    campo.removeAttribute("aria-invalid")
  }
  mensagemFormulario.textContent = ""
}

form.addEventListener("submit", (evento: SubmitEvent) => {
  evento.preventDefault()
  if (despesasBloqueadas) return

  limparErros()

  const titulo = tituloInput.value.trim()
  const valor = Number(valorInput.value)
  const data = dataInput.value
  const categoriaSelecionada = categoriaInput.value
  const formaPagamentoSelecionada = formaPagamentoInput.value
  const recorrente = checkboxDespesaRecorrente.checked
  const frequenciaSelecionada = recorrente
    ? (frequenciaRecorrencia.value as FrequenciaRecorrencia)
    : undefined
  const camposInvalidos: Array<HTMLInputElement | HTMLSelectElement> = []

  if (!titulo) camposInvalidos.push(tituloInput)
  if (!Number.isFinite(valor) || valor <= 0) camposInvalidos.push(valorInput)
  if (!data) camposInvalidos.push(dataInput)
  if (!CATEGORIAS.some((categoria) => categoria === categoriaSelecionada)) {
    camposInvalidos.push(categoriaInput)
  }
  if (
    !FORMAS_PAGAMENTO.some(
      (forma) => forma === formaPagamentoSelecionada,
    )
  ) {
    camposInvalidos.push(formaPagamentoInput)
  }

  if (camposInvalidos.length > 0) {
    camposInvalidos.forEach(marcarCampoInvalido)
    mensagemFormulario.textContent =
      "Preencha título, valor maior que zero, data, categoria e forma de pagamento."
    camposInvalidos[0].focus()
    return
  }

  const novaDespesa: Despesa = {
    id: crypto.randomUUID(),
    titulo,
    valor,
    categoria: categoriaSelecionada as Categoria,
    formaPagamento: formaPagamentoSelecionada as FormaPagamento,
    data,
    recorrente,
    frequencia: recorrente ? frequenciaSelecionada : undefined,
  }

  if (despesaEmEdicaoId) {
    const despesa = despesas.find((item) => item.id === despesaEmEdicaoId)

    if (despesa) {
      despesa.titulo = titulo
      despesa.valor = valor
      despesa.categoria = categoriaSelecionada as Categoria
      despesa.formaPagamento =
        formaPagamentoSelecionada as FormaPagamento
      despesa.data = data
      despesa.recorrente = recorrente
      despesa.frequencia = recorrente ? frequenciaSelecionada : undefined
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

function atualizarDespesasFiltradas(): void {
  renderizarLista()
  atualizarResumo()
}

function atualizarAvisoArmazenamento(): void {
  avisoArmazenamento.hidden = !despesasBloqueadas
  if (despesasBloqueadas) {
    avisoArmazenamentoTexto.textContent =
      erroCarregamentoDespesas === "corrompido"
        ? "Os dados de despesas salvos neste navegador estão inválidos ou incompletos. As despesas reconhecidas são exibidas, mas alterações e exportações foram bloqueadas para evitar sobrescrever dados recuperáveis. Exporte o conteúdo bruto ou importe um backup válido para restaurar o uso normal."
        : "Não foi possível acessar os dados de despesas salvos neste navegador. Alterações e exportações foram bloqueadas para evitar sobrescrever dados recuperáveis. Tente novamente em um navegador com armazenamento disponível ou importe um backup válido."
  }
  botaoExportarDadosBrutos.hidden =
    !despesasBloqueadas || dadosDespesasBrutos === null

  for (const controle of form.querySelectorAll<
    HTMLInputElement | HTMLSelectElement | HTMLButtonElement
  >("input, select, button")) {
    controle.disabled = despesasBloqueadas
  }
  botaoExportarBackup.disabled = despesasBloqueadas
  botaoImportarCsv.disabled = despesasBloqueadas
  botaoExportar.disabled =
    despesasBloqueadas || despesas.length === 0
}

function exportarDadosBrutos(): void {
  if (dadosDespesasBrutos === null) return

  const arquivo = new Blob([dadosDespesasBrutos], {
    type: "text/plain;charset=utf-8",
  })
  const url = URL.createObjectURL(arquivo)
  const link = document.createElement("a")
  link.href = url
  link.download = `recuperacao-despesas-${obterDataISOlocal()}.txt`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

checkboxDespesaRecorrente.addEventListener("change", atualizarVisibilidadeRecorrencia)
listaLimitesCategoria.addEventListener("input", (evento: Event) => {
  const input = evento.target
  if (!(input instanceof HTMLInputElement)) return

  const categoria = CATEGORIAS.find(
    (item) => item === input.dataset.categoria,
  )
  if (!categoria) return

  const limite = input.value === "" ? 0 : Number(input.value)
  if (!Number.isFinite(limite) || limite < 0) return

  const limiteAnterior = limitesCategoria[categoria]
  if (limite > 0) {
    limitesCategoria[categoria] = limite
  } else {
    delete limitesCategoria[categoria]
  }

  if (!salvarLimitesCategoria(limitesCategoria)) {
    if (typeof limiteAnterior === "number") {
      limitesCategoria[categoria] = limiteAnterior
      input.value = String(limiteAnterior)
    } else {
      delete limitesCategoria[categoria]
      input.value = ""
    }
    statusLimitesCategoria.textContent =
      "Não foi possível salvar o limite neste navegador."
    atualizarResumo()
    return
  }

  statusLimitesCategoria.textContent = "Limites salvos neste navegador."
  atualizarResumo()
})
filtroMes.addEventListener("change", atualizarDespesasFiltradas)
filtroCategoria.addEventListener("change", atualizarDespesasFiltradas)
filtroPagamento.addEventListener("change", atualizarDespesasFiltradas)
filtroTexto.addEventListener("input", atualizarDespesasFiltradas)
ordenacaoLista.addEventListener("change", atualizarDespesasFiltradas)

botaoExportar.addEventListener("click", exportarDespesasVisiveis)
botaoExportarBackup.addEventListener("click", exportarBackup)
botaoExportarDadosBrutos.addEventListener("click", exportarDadosBrutos)
botaoImportarBackup.addEventListener("click", () => {
  arquivoBackup.click()
})
botaoImportarCsv.addEventListener("click", () => {
  arquivoCsv.click()
})
arquivoBackup.addEventListener("change", async () => {
  const arquivo = arquivoBackup.files?.[0]
  if (!arquivo) return

  try {
    await importarBackup(arquivo)
  } finally {
    arquivoBackup.value = ""
  }
})
arquivoCsv.addEventListener("change", async () => {
  const arquivo = arquivoCsv.files?.[0]
  if (!arquivo) return

  try {
    await prepararImportacaoCsv(arquivo)
  } finally {
    arquivoCsv.value = ""
  }
})
botaoConfirmarImportacaoCsv.addEventListener(
  "click",
  confirmarImportacaoCsv,
)
botaoCancelarImportacaoCsv.addEventListener("click", () => {
  dialogImportarCsv.close()
})
dialogImportarCsv.addEventListener("close", () => {
  importacaoCsvPendente = null
})

inputMetaMensal.addEventListener("input", () => {
  const valorMeta = Number(inputMetaMensal.value)
  const metaValida =
    Number.isFinite(valorMeta) && valorMeta >= 0 ? valorMeta : 0

  salvarMetaMensal(metaValida)
  atualizarResumo()
})

inputMetaMensal.value = String(carregarMetaMensal())

atualizarAvisoArmazenamento()
inicializarLimitesCategoria()
atualizarVisibilidadeRecorrencia()
atualizarListaMeses()
renderizarLista()
atualizarResumo()
limparFormulario()
