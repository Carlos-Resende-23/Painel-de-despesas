import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { beforeEach, describe, expect, test, vi } from "vitest"

const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8")
const corpo =
  html
    .match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1]
    ?.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") ?? ""

function textoNormalizado(elemento: Element | null): string {
  return elemento?.textContent?.replace(/\s/g, " ") ?? ""
}

async function inicializarPainel(despesasSalvas?: unknown): Promise<void> {
  vi.resetModules()
  document.body.innerHTML = corpo
  localStorage.clear()
  if (despesasSalvas) {
    localStorage.setItem("painel-despesas:v1", JSON.stringify(despesasSalvas))
  }
  await import("../src/main.ts")
}

function preencherDespesa(): void {
  const titulo = document.querySelector<HTMLInputElement>("#titulo")!
  const valor = document.querySelector<HTMLInputElement>("#valor")!
  const data = document.querySelector<HTMLInputElement>("#data-despesa")!
  const categoria = document.querySelector<HTMLSelectElement>("#categoria")!
  const pagamento =
    document.querySelector<HTMLSelectElement>("#forma-pagamento")!
  const observacao =
    document.querySelector<HTMLTextAreaElement>("#observacao")!

  titulo.value = "Mercado"
  valor.value = "125.50"
  data.value = "2026-11-21"
  categoria.value = "alimento"
  pagamento.value = "pix"
  observacao.value = "Compra para o escritório"
}

beforeEach(async () => {
  await inicializarPainel()
})

describe("interface do painel", () => {
  test("inicia com o resumo vazio e a lista vazia", () => {
    expect(textoNormalizado(document.querySelector("#total-geral"))).toBe(
      "R$ 0,00",
    )
    expect(document.querySelector("#lista-vazia")?.hasAttribute("hidden")).toBe(false)
    expect(document.querySelectorAll("#lista-despesas > li")).toHaveLength(0)
  })

  test("valida os campos antes de adicionar uma despesa", () => {
    const formulario = document.querySelector<HTMLFormElement>("#form-despesa")!
    formulario.dispatchEvent(
      new SubmitEvent("submit", { bubbles: true, cancelable: true }),
    )

    expect(document.querySelector("#mensagem-formulario")?.textContent).toContain(
      "Preencha título",
    )
    expect(document.querySelector("#titulo")?.getAttribute("aria-invalid")).toBe(
      "true",
    )
  })

  test("adiciona uma despesa válida e persiste no navegador", () => {
    preencherDespesa()

    const formulario = document.querySelector<HTMLFormElement>("#form-despesa")!
    formulario.dispatchEvent(
      new SubmitEvent("submit", { bubbles: true, cancelable: true }),
    )

    expect(document.querySelector("#mensagem-formulario")?.textContent).toBe(
      "Despesa adicionada.",
    )
    expect(document.querySelectorAll("#lista-despesas > li")).toHaveLength(1)
    expect(document.querySelector(".expense-title")?.textContent).toBe("Mercado")
    expect(document.querySelector(".expense-observation")?.textContent).toBe(
      "Compra para o escritório",
    )
    expect(textoNormalizado(document.querySelector("#total-geral"))).toBe(
      "R$ 125,50",
    )

    const despesasSalvas = JSON.parse(
      localStorage.getItem("painel-despesas:v1") ?? "[]",
    )
    expect(despesasSalvas).toHaveLength(1)
    expect(despesasSalvas[0]).toMatchObject({
      titulo: "Mercado",
      valor: 125.5,
      categoria: "alimento",
      formaPagamento: "pix",
      data: "2026-11-21",
      observacao: "Compra para o escritório",
    })
  })

  test("carrega e atualiza a observação ao editar uma despesa", async () => {
    await inicializarPainel([
      {
        id: "despesa-existente",
        titulo: "Mercado",
        valor: 125.5,
        categoria: "alimento",
        formaPagamento: "pix",
        data: "2026-11-21",
        observacao: "Compra semanal",
      },
    ])

    document.querySelector<HTMLButtonElement>(".expense-edit")!.click()
    const observacao =
      document.querySelector<HTMLTextAreaElement>("#observacao")!
    expect(observacao.value).toBe("Compra semanal")

    observacao.value = "Compra mensal"
    document
      .querySelector<HTMLFormElement>("#form-despesa")!
      .dispatchEvent(
        new SubmitEvent("submit", { bubbles: true, cancelable: true }),
      )

    expect(
      JSON.parse(localStorage.getItem("painel-despesas:v1") ?? "[]")[0]
        .observacao,
    ).toBe("Compra mensal")
  })

  test("exclui uma despesa e permite desfazer a exclusão", async () => {
    await inicializarPainel([
      {
        id: "despesa-existente",
        titulo: "Mercado",
        valor: 125.5,
        categoria: "alimento",
        formaPagamento: "pix",
        data: "2026-11-21",
      },
    ])

    document.querySelector<HTMLButtonElement>(".expense-delete")!.click()
    expect(document.querySelectorAll("#lista-despesas > li")).toHaveLength(0)
    expect(document.querySelector("#desfazer-exclusao")?.hasAttribute("hidden")).toBe(false)

    document.querySelector<HTMLButtonElement>("#desfazer-exclusao-botao")!.click()
    expect(document.querySelectorAll("#lista-despesas > li")).toHaveLength(1)
    expect(document.querySelector(".expense-title")?.textContent).toBe("Mercado")
  })

  test("combina filtros de texto, categoria e forma de pagamento", async () => {
    await inicializarPainel([
      {
        id: "mercado-pix",
        titulo: "Mercado da semana",
        valor: 100,
        categoria: "alimento",
        formaPagamento: "pix",
        data: "2026-11-21",
      },
      {
        id: "mercado-credito",
        titulo: "Mercado gourmet",
        valor: 250,
        categoria: "alimento",
        formaPagamento: "credito",
        data: "2026-11-20",
      },
      {
        id: "livro-pix",
        titulo: "Livro",
        valor: 80,
        categoria: "lazer",
        formaPagamento: "pix",
        data: "2026-11-19",
      },
    ])

    const filtroTexto =
      document.querySelector<HTMLInputElement>("#filtro-texto")!
    const filtroCategoria =
      document.querySelector<HTMLSelectElement>("#filtro-categoria")!
    const filtroPagamento =
      document.querySelector<HTMLSelectElement>("#filtro-pagamento")!

    filtroTexto.value = "mercado"
    filtroTexto.dispatchEvent(new Event("input", { bubbles: true }))
    filtroCategoria.value = "alimento"
    filtroCategoria.dispatchEvent(new Event("change", { bubbles: true }))
    filtroPagamento.value = "credito"
    filtroPagamento.dispatchEvent(new Event("change", { bubbles: true }))

    expect(document.querySelectorAll("#lista-despesas > li")).toHaveLength(1)
    expect(document.querySelector(".expense-title")?.textContent).toBe(
      "Mercado gourmet",
    )
  })

  test("limpa os filtros e restaura todas as despesas", async () => {
    await inicializarPainel([
      {
        id: "1",
        titulo: "Mercado",
        valor: 100,
        categoria: "alimento",
        formaPagamento: "pix",
        data: "2026-11-21",
      },
      {
        id: "2",
        titulo: "Cinema",
        valor: 80,
        categoria: "lazer",
        formaPagamento: "credito",
        data: "2026-11-20",
      },
    ])

    const filtroTexto =
      document.querySelector<HTMLInputElement>("#filtro-texto")!
    filtroTexto.value = "mercado"
    filtroTexto.dispatchEvent(new Event("input", { bubbles: true }))
    expect(document.querySelectorAll("#lista-despesas > li")).toHaveLength(1)

    document.querySelector<HTMLButtonElement>("#limpar-filtros")!.click()
    expect(document.querySelectorAll("#lista-despesas > li")).toHaveLength(2)
    expect(filtroTexto.value).toBe("")
  })

  test("cadastra uma despesa recorrente mensal", () => {
    preencherDespesa()
    document.querySelector<HTMLInputElement>("#despesa-recorrente")!.checked =
      true
    document
      .querySelector<HTMLInputElement>("#despesa-recorrente")!
      .dispatchEvent(new Event("change", { bubbles: true }))
    document.querySelector<HTMLSelectElement>(
      "#frequencia-recorrencia",
    )!.value = "mensal"

    document
      .querySelector<HTMLFormElement>("#form-despesa")!
      .dispatchEvent(
        new SubmitEvent("submit", { bubbles: true, cancelable: true }),
      )

    const badges = Array.from(
      document.querySelectorAll(".recurrence-badge"),
      (elemento) => elemento.textContent,
    )
    expect(badges).toContain("Recorrente · Mensal")
    expect(
      JSON.parse(localStorage.getItem("painel-despesas:v1") ?? "[]")[0],
    ).toMatchObject({ recorrente: true, frequencia: "mensal" })
  })

  test("valida e cadastra uma compra parcelada", () => {
    preencherDespesa()
    document.querySelector<HTMLInputElement>("#despesa-parcelada")!.checked =
      true
    document
      .querySelector<HTMLInputElement>("#despesa-parcelada")!
      .dispatchEvent(new Event("change", { bubbles: true }))
    document.querySelector<HTMLInputElement>("#total-parcelas")!.value = "6"

    document
      .querySelector<HTMLFormElement>("#form-despesa")!
      .dispatchEvent(
        new SubmitEvent("submit", { bubbles: true, cancelable: true }),
      )

    const badges = Array.from(
      document.querySelectorAll(".recurrence-badge"),
      (elemento) => elemento.textContent,
    )
    expect(badges).toContain("Parcelamento · 1/6")
    expect(
      JSON.parse(localStorage.getItem("painel-despesas:v1") ?? "[]")[0],
    ).toMatchObject({
      parcelamento: { totalParcelas: 6, parcelasPagas: 1 },
    })
  })

  test("bloqueia alterações quando os dados persistidos estão corrompidos", async () => {
    vi.resetModules()
    document.body.innerHTML = corpo
    localStorage.clear()
    localStorage.setItem("painel-despesas:v1", "{dados inválidos")
    await import("../src/main.ts")

    expect(document.querySelector("#aviso-armazenamento")?.hasAttribute("hidden")).toBe(false)
    expect(
      document.querySelector<HTMLButtonElement>("#submit-despesa")?.disabled,
    ).toBe(true)
  })
})
