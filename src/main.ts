import "./style.css"
import { CATEGORIAS, type Categoria, type Despesa } from "./types.ts"

const despesas: Despesa[] = []

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
  quantidadeDespesas.textContent = `${despesas.length} ${despesas.length === 1 ? "despesa" : "despesas"} nesta sessão`
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

  detalhes.append(titulo, categoria)
  item.append(detalhes, valor)
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

  form.reset()
  mensagemFormulario.textContent = "Despesa adicionada."
  tituloInput.focus()
})

atualizarResumo()
