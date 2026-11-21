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

async function inicializarPainel(): Promise<void> {
  vi.resetModules()
  document.body.innerHTML = corpo
  localStorage.clear()
  await import("../src/main.ts")
}

function preencherDespesa(): void {
  const titulo = document.querySelector<HTMLInputElement>("#titulo")!
  const valor = document.querySelector<HTMLInputElement>("#valor")!
  const data = document.querySelector<HTMLInputElement>("#data-despesa")!
  const categoria = document.querySelector<HTMLSelectElement>("#categoria")!
  const pagamento =
    document.querySelector<HTMLSelectElement>("#forma-pagamento")!

  titulo.value = "Mercado"
  valor.value = "125.50"
  data.value = "2026-11-21"
  categoria.value = "alimento"
  pagamento.value = "pix"
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
    })
  })
})
