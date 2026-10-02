import "./style.css"
import { CATEGORIAS, type Categoria, type Despesa } from "./types.ts"

const CHAVE_ARMAZENAMENTO = "painel-despesas:v1"

function ehDespesa(valor: unknown): valor is Despesa {
  if (typeof valor !== "object" || valor === null) return false

  const registro = valor as Record<string, unknown>
  return (
    typeof registro.id === "string" &&
    typeof registro.titulo === "string" &&
    registro.titulo.trim().length > 0 &&
    typeof registro.valor === "number" &&
    Number.isFinite(registro.valor) &&
    registro.valor > 0 &&
    CATEGORIAS.some((categoria) => categoria === registro.categoria)
  )
}

function carregarDespesas(): Despesa[] {
  try {
    const dados = localStorage.getItem(CHAVE_ARMAZENAMENTO)
    if (!dados) return []

    const despesasSalvas: unknown = JSON.parse(dados)
    return Array.isArray(despesasSalvas) ? despesasSalvas.filter(ehDespesa) : []
  } catch {
    return []
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

function atualizarResumo(): void {
  const total = despesas.reduce((soma, despesa) => soma + despesa.valor, 0)
  totalGeral.textContent = formatadorMoeda.format(total)
  quantidadeDespesas.textContent = `${despesas.length} ${despesas.length === 1 ? "despesa" : "despesas"} no total`
  contadorLista.textContent = `${despesas.length} ${despesas.length === 1 ? "item" : "itens"}`

  for (const categoria of CATEGORIAS) {
    const totalCategoria = despesas
      .filter((despesa) => despesa.categoria === categoria)
      .reduce((soma, despesa) => soma + despesa.valor, 0)
    const elementoTotal = document.querySelector<HTMLElement>(
      `[data-total-categoria="${categoria}"]`,
    )

    if (elementoTotal) {
      elementoTotal.textContent = formatadorMoeda.format(totalCategoria)
    }
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

function criarItemDespesa(despesa: Despesa): HTMLLIElement {
  const item = document.createElement("li")
  item.className = "expense-item"

  const detalhes = document.createElement("div")
  detalhes.className = "expense-details"

  const titulo = document.createElement("h3")
  titulo.className = "expense-title"
  titulo.textContent = despesa.titulo

  const categoria = document.createElement("span")
  categoria.className = "category-badge"
  categoria.dataset.category = despesa.categoria
  categoria.textContent = nomesCategoria[despesa.categoria]

  const valor = document.createElement("p")
  valor.className = "expense-value"
  valor.textContent = formatadorMoeda.format(despesa.valor)

  const acoes = document.createElement("div")
  acoes.className = "expense-actions"

  const botaoExcluir = document.createElement("button")
  botaoExcluir.className = "expense-delete"
  botaoExcluir.type = "button"
  botaoExcluir.textContent = "Excluir"
  botaoExcluir.setAttribute("aria-label", `Excluir despesa: ${despesa.titulo}`)
  botaoExcluir.addEventListener("click", () => {
    const indice = despesas.findIndex((item) => item.id === despesa.id)
    if (indice === -1) return

    despesas.splice(indice, 1)
    item.remove()
    listaVazia.hidden = despesas.length > 0
    atualizarResumo()
    mensagemFormulario.textContent = salvarDespesas()
      ? "Despesa excluída."
      : "Despesa excluída, mas não foi possível salvar a alteração neste navegador."
  })

  detalhes.append(titulo, categoria)
  acoes.append(valor, botaoExcluir)
  item.append(detalhes, acoes)
  return item
}

function marcarCampoInvalido(
  campo: HTMLInputElement | HTMLSelectElement,
): void {
  campo.setAttribute("aria-invalid", "true")
}

function limparErros(): void {
  for (const campo of [tituloInput, valorInput, categoriaInput]) {
    campo.removeAttribute("aria-invalid")
  }
  mensagemFormulario.textContent = ""
}

form.addEventListener("submit", (evento: SubmitEvent) => {
  evento.preventDefault()
  limparErros()

  const titulo = tituloInput.value.trim()
  const valor = Number(valorInput.value)
  const categoriaSelecionada = categoriaInput.value
  const camposInvalidos: Array<HTMLInputElement | HTMLSelectElement> = []

  if (!titulo) camposInvalidos.push(tituloInput)
  if (!Number.isFinite(valor) || valor <= 0) camposInvalidos.push(valorInput)
  if (!CATEGORIAS.some((categoria) => categoria === categoriaSelecionada)) {
    camposInvalidos.push(categoriaInput)
  }

  if (camposInvalidos.length > 0) {
    camposInvalidos.forEach(marcarCampoInvalido)
    mensagemFormulario.textContent =
      "Preencha título, valor maior que zero e categoria."
    camposInvalidos[0].focus()
    return
  }

  const despesa: Despesa = {
    id: crypto.randomUUID(),
    titulo,
    valor,
    categoria: categoriaSelecionada as Categoria,
  }

  despesas.push(despesa)
  listaDespesas.prepend(criarItemDespesa(despesa))
  listaVazia.hidden = true
  atualizarResumo()
  const foiSalva = salvarDespesas()

  form.reset()
  mensagemFormulario.textContent = foiSalva
    ? "Despesa adicionada."
    : "Despesa adicionada, mas não foi possível salvar neste navegador."
  tituloInput.focus()
})

for (const despesa of [...despesas].reverse()) {
  listaDespesas.append(criarItemDespesa(despesa))
}
listaVazia.hidden = despesas.length > 0
atualizarResumo()
