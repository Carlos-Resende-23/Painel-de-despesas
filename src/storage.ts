import {
  ehLimitesCategoria,
  interpretarDespesasArmazenadas,
  salvarBackupImportado,
  type Backup,
  type ChavesBackup,
} from "./domain.ts"
import type { Despesa, LimitesCategoria } from "./types.ts"

export type ArmazenamentoPainel = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>

export const CHAVES_PAINEL: ChavesBackup = {
  despesas: "painel-despesas:v1",
  metaMensal: "painel-despesas:meta-mensal:v1",
  limitesCategoria: "painel-despesas:limites-categoria:v1",
}

export type EstadoArmazenamentoPainel = {
  despesas: Despesa[]
  dadosBrutos: string | null
  erro: "corrompido" | "indisponivel" | null
  metaMensal: number
  limitesCategoria: LimitesCategoria
}

export class RepositorioPainel {
  private readonly armazenamento: ArmazenamentoPainel

  constructor(armazenamento: ArmazenamentoPainel) {
    this.armazenamento = armazenamento
  }

  carregar(): EstadoArmazenamentoPainel {
    let dadosBrutos: string | null
    try {
      dadosBrutos = this.armazenamento.getItem(CHAVES_PAINEL.despesas)
    } catch {
      return {
        despesas: [],
        dadosBrutos: null,
        erro: "indisponivel",
        metaMensal: 0,
        limitesCategoria: {},
      }
    }

    const resultadoDespesas =
      interpretarDespesasArmazenadas(dadosBrutos)

    let metaMensal = 0
    try {
      const dadosMeta = this.armazenamento.getItem(CHAVES_PAINEL.metaMensal)
      if (dadosMeta) {
        const valor = Number(dadosMeta)
        metaMensal = Number.isFinite(valor) && valor >= 0 ? valor : 0
      }
    } catch {
      metaMensal = 0
    }

    let limitesCategoria: LimitesCategoria = {}
    try {
      const dadosLimites = this.armazenamento.getItem(
        CHAVES_PAINEL.limitesCategoria,
      )
      if (dadosLimites) {
        const limites: unknown = JSON.parse(dadosLimites)
        if (ehLimitesCategoria(limites)) {
          limitesCategoria = limites
        }
      }
    } catch {
      limitesCategoria = {}
    }

    return {
      despesas: resultadoDespesas.despesas,
      dadosBrutos,
      erro: resultadoDespesas.corrompido ? "corrompido" : null,
      metaMensal,
      limitesCategoria,
    }
  }

  salvarDespesas(despesas: readonly Despesa[]): boolean {
    try {
      this.armazenamento.setItem(
        CHAVES_PAINEL.despesas,
        JSON.stringify(despesas),
      )
      return true
    } catch {
      return false
    }
  }

  salvarMetaMensal(valor: number): boolean {
    try {
      this.armazenamento.setItem(CHAVES_PAINEL.metaMensal, String(valor))
      return true
    } catch {
      return false
    }
  }

  salvarLimitesCategoria(limites: LimitesCategoria): boolean {
    try {
      this.armazenamento.setItem(
        CHAVES_PAINEL.limitesCategoria,
        JSON.stringify(limites),
      )
      return true
    } catch {
      return false
    }
  }

  salvarBackup(
    backup: Backup,
  ): "salvo" | "falhou" | "falhou-parcial" {
    return salvarBackupImportado(
      this.armazenamento,
      CHAVES_PAINEL,
      backup,
    )
  }
}
