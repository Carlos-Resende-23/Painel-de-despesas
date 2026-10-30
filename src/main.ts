import "./style.css"
import {
  CATEGORIAS,
  FREQUENCIAS,
  type Categoria,
  type Despesa,
  type FrequenciaRecorrencia,
} from "./types.ts"

const CHAVE_ARMAZENAMENTO = "painel-despesas:v1"
const CHAVE_META_MENSAL = "painel-despesas:meta-mensal:v1"

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

function ehDataValida(data: string): boolean {
  const dataBrasileira = /^(\d{2})-(\d{2})-(\d{4})$/.exec(data)
  const dataISO = dataBrasileira
    ? `${dataBrasileira[3]}-${dataBrasileira[2]}-${dataBrasileira[1]}`
    : data

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dataISO)) {
    return !Number.isNaN(Date.parse(data))
  }

  const dataConvertida = new Date(`${dataISO}T00:00:00Z`)
  return (
    !Number.isNaN(dataConvertida.getTime()) &&
    dataConvertida.toISOString().slice(0, 10) === dataISO
  )
}

function ehDespesa(valor: unknown): valor is Despesa {
  if (typeof valor !== "object" || valor === null) return false

  const registro = valor as Record<string, unknown>
  const dataValida =
    typeof registro.data !== "string" ||
    ehDataValida(registro.data)
  const recorrenteValido =
    typeof registro.recorrente === "undefined" ||
    typeof registro.recorrente === "boolean"
  const frequenciaValida =
    typeof registro.frequencia === "undefined" ||
    (typeof registro.frequencia === "string" &&
      FREQUENCIAS.some((frequencia) => frequencia === registro.frequencia))
  const ocorrenciasRegistradasValidas =
    typeof registro.ocorrenciasRegistradas === "undefined" ||
    (Array.isArray(registro.ocorrenciasRegistradas) &&
      registro.ocorrenciasRegistradas.every(
        (data) =>
          typeof data === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(data) &&
          ehDataValida(data),
      ))

  return (
    typeof registro.id === "string" &&
    typeof registro.titulo === "string" &&
    registro.titulo.trim().length > 0 &&
    typeof registro.valor === "number" &&
    Number.isFinite(registro.valor) &&
    registro.valor > 0 &&
    CATEGORIAS.some((categoria) => categoria === registro.categoria) &&
    dataValida &&
    recorrenteValido &&
    frequenciaValida &&
    ocorrenciasRegistradasValidas
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
        data: obterDataParaFormulario(despesa.data),
      }))
    }

    if (typeof despesasSalvas === "object" && despesasSalvas !== null) {
      const estado = despesasSalvas as { despesas?: unknown[] }
      if (Array.isArray(estado.despesas)) {
        return estado.despesas.filter(ehDespesa).map((despesa) => ({
          ...despesa,
          data: obterDataParaFormulario(despesa.data),
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
const botaoExportar = selecionarElemento<HTMLButtonElement>(
  "#exportar-despesas",
)
const botaoExportarBackup =
  selecionarElemento<HTMLButtonElement>("#exportar-backup")
const botaoImportarBackup =
  selecionarElemento<HTMLButtonElement>("#importar-backup")
const arquivoBackup = selecionarElemento<HTMLInputElement>("#arquivo-backup")
const statusBackup =
  selecionarElemento<HTMLParagraphElement>("#backup-status")
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

type OcorrenciaPrevista = {
  despesa: Despesa
  data: string
}

function obterOcorrenciasPrevistas(): OcorrenciaPrevista[] {
  const hoje = obterDataISOlocal()
  const [anoAtual, mesAtual] = hoje.split("-").map(Number)
  const mesAtualIndice = anoAtual * 12 + mesAtual - 1
  const ocorrencias: OcorrenciaPrevista[] = []

  for (const despesa of despesas) {
    if (!despesa.recorrente) continue

    const dataBase = obterDataParaFormulario(despesa.data)
    const [anoBase, mesBase, diaBase] = dataBase.split("-").map(Number)
    const mesBaseIndice = anoBase * 12 + mesBase - 1
    const intervalo =
      despesa.frequencia === "anual"
        ? 12
        : despesa.frequencia === "trimestral"
          ? 3
          : 1
    const ocorrenciasRegistradas = new Set(
      despesa.ocorrenciasRegistradas ?? [],
    )

    for (let deslocamento = 0; deslocamento < 6; deslocamento += 1) {
      const indiceMes = mesAtualIndice + deslocamento
      const mesesDesdeBase = indiceMes - mesBaseIndice
      if (mesesDesdeBase <= 0 || mesesDesdeBase % intervalo !== 0) continue

      const ano = Math.floor(indiceMes / 12)
      const mes = indiceMes % 12
      const ultimoDia = new Date(ano, mes + 1, 0).getDate()
      const dia = Math.min(diaBase, ultimoDia)
      const data = obterDataISOlocal(new Date(ano, mes, dia))

      if (data >= hoje && !ocorrenciasRegistradas.has(data)) {
        ocorrencias.push({ despesa, data })
      }
    }
  }

  return ocorrencias.sort(
    (a, b) => a.data.localeCompare(b.data) ||
      a.despesa.titulo.localeCompare(b.despesa.titulo, "pt-BR"),
  )
}

function registrarOcorrencia(
  despesa: Despesa,
  data: string,
): void {
  const ocorrenciasAnteriores = despesa.ocorrenciasRegistradas
  despesa.ocorrenciasRegistradas = [...(ocorrenciasAnteriores ?? []), data]
  despesas.push({
    id: crypto.randomUUID(),
    titulo: despesa.titulo,
    valor: despesa.valor,
    categoria: despesa.categoria,
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
  const total = ocorrencias.reduce(
    (soma, ocorrencia) => soma + ocorrencia.despesa.valor,
    0,
  )
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
      itens.reduce((soma, item) => soma + item.despesa.valor, 0),
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

    return (
      correspondeAoMes &&
      correspondeACategoria &&
      tituloNormalizado.includes(textoBusca)
    )
  })
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
  const despesasRecorrentes = despesas.filter((despesa) => despesa.recorrente)
  const totalRecorrente = despesasRecorrentes.reduce(
    (soma, despesa) => soma + despesa.valor,
    0,
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

  detalhes.append(titulo, categoria, recorrencia, data)
  acoes.append(valor, botaoEditar, botaoExcluir)
  item.append(detalhes, acoes)
  return item
}

function renderizarLista(): void {
  const despesasVisiveis = obterDespesasVisiveis()
  renderizarPrevisao()
  listaDespesas.innerHTML = ""
  botaoExportar.disabled = despesasVisiveis.length === 0

  for (const despesa of [...despesasVisiveis].reverse()) {
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
  const linhas = [
    ["Título", "Valor", "Categoria", "Data"],
    ...[...obterDespesasVisiveis()].reverse().map((despesa) => [
      despesa.titulo,
      despesa.valor.toFixed(2).replace(".", ","),
      nomesCategoria[despesa.categoria],
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

function exportarBackup(): void {
  const backup = {
    formato: "painel-de-despesas",
    versao: 1,
    exportadoEm: new Date().toISOString(),
    despesas,
    metaMensal: Number(inputMetaMensal.value || 0),
  }
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

function ehBackup(valor: unknown): valor is {
  formato: "painel-de-despesas"
  versao: 1
  despesas: Despesa[]
  metaMensal: number
} {
  if (typeof valor !== "object" || valor === null) return false

  const backup = valor as Record<string, unknown>
  if (
    backup.formato !== "painel-de-despesas" ||
    backup.versao !== 1 ||
    !Array.isArray(backup.despesas) ||
    typeof backup.metaMensal !== "number" ||
    !Number.isFinite(backup.metaMensal) ||
    backup.metaMensal < 0
  ) {
    return false
  }

  const ids = new Set<string>()
  for (const despesa of backup.despesas) {
    if (
      !ehDespesa(despesa) ||
      !despesa.id.trim() ||
      (despesa.data !== undefined &&
        (typeof despesa.data !== "string" || !ehDataValida(despesa.data))) ||
      ids.has(despesa.id)
    ) {
      return false
    }
    ids.add(despesa.id)
  }

  return true
}

function restaurarValorArmazenado(chave: string, valor: string | null): boolean {
  try {
    if (valor === null) {
      localStorage.removeItem(chave)
    } else {
      localStorage.setItem(chave, valor)
    }
    return true
  } catch {
    return false
  }
}

function salvarBackupImportado(backup: {
  despesas: Despesa[]
  metaMensal: number
}): "salvo" | "falhou" | "falhou-parcial" {
  let despesasAnteriores: string | null
  let metaAnterior: string | null

  try {
    despesasAnteriores = localStorage.getItem(CHAVE_ARMAZENAMENTO)
    metaAnterior = localStorage.getItem(CHAVE_META_MENSAL)
  } catch {
    return "falhou"
  }

  let despesasGravadas = false
  let metaGravada = false
  try {
    localStorage.setItem(CHAVE_ARMAZENAMENTO, JSON.stringify(backup.despesas))
    despesasGravadas = true
    localStorage.setItem(CHAVE_META_MENSAL, String(backup.metaMensal))
    metaGravada = true
    return "salvo"
  } catch {
    const despesasRestauradas =
      !despesasGravadas ||
      restaurarValorArmazenado(CHAVE_ARMAZENAMENTO, despesasAnteriores)
    const metaRestaurada =
      !metaGravada || restaurarValorArmazenado(CHAVE_META_MENSAL, metaAnterior)
    return despesasRestauradas && metaRestaurada ? "falhou" : "falhou-parcial"
  }
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
    `Este backup substituirá ${quantidadeAtual} por ${quantidadeBackup} e atualizará a meta mensal. Deseja continuar?`,
  )
  if (!confirmou) {
    statusBackup.textContent = "Importação cancelada."
    return
  }

  const resultado = salvarBackupImportado(backup)
  if (resultado !== "salvo") {
    statusBackup.textContent =
      resultado === "falhou"
        ? "Não foi possível salvar o backup. Os dados atuais foram preservados."
        : "Falha ao salvar e restaurar os dados anteriores. Verifique o armazenamento do navegador."
    return
  }

  despesas.splice(0, despesas.length)
  backup.despesas.forEach((despesa) => despesas.push({ ...despesa }))
  inputMetaMensal.value = String(backup.metaMensal)
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
    recorrente,
    frequencia: recorrente ? frequenciaSelecionada : undefined,
  }

  if (despesaEmEdicaoId) {
    const despesa = despesas.find((item) => item.id === despesaEmEdicaoId)

    if (despesa) {
      despesa.titulo = titulo
      despesa.valor = valor
      despesa.categoria = categoriaSelecionada as Categoria
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

checkboxDespesaRecorrente.addEventListener("change", atualizarVisibilidadeRecorrencia)
filtroMes.addEventListener("change", atualizarDespesasFiltradas)
filtroCategoria.addEventListener("change", atualizarDespesasFiltradas)
filtroTexto.addEventListener("input", atualizarDespesasFiltradas)

botaoExportar.addEventListener("click", exportarDespesasVisiveis)
botaoExportarBackup.addEventListener("click", exportarBackup)
botaoImportarBackup.addEventListener("click", () => {
  arquivoBackup.click()
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

inputMetaMensal.addEventListener("input", () => {
  const valorMeta = Number(inputMetaMensal.value)
  const metaValida =
    Number.isFinite(valorMeta) && valorMeta >= 0 ? valorMeta : 0

  salvarMetaMensal(metaValida)
  atualizarResumo()
})

inputMetaMensal.value = String(carregarMetaMensal())

atualizarVisibilidadeRecorrencia()
atualizarListaMeses()
renderizarLista()
atualizarResumo()
limparFormulario()
