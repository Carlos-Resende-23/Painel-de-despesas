export const CATEGORIAS = [
  "alimento",
  "transporte",
  "lazer",
  "saúde",
  "outros",
] as const

export const FREQUENCIAS = ["mensal", "trimestral", "anual"] as const
export const FORMAS_PAGAMENTO = ["pix", "credito", "debito", "dinheiro"] as const
export const ORDENACOES_DESPESAS = [
  "recentes",
  "antigas",
  "maior-valor",
  "menor-valor",
] as const

export type Categoria = (typeof CATEGORIAS)[number]
export type FrequenciaRecorrencia = (typeof FREQUENCIAS)[number]
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number]
export type OrdenacaoDespesas = (typeof ORDENACOES_DESPESAS)[number]
export type LimitesCategoria = Partial<Record<Categoria, number>>

export type Despesa = {
  id: string
  titulo: string
  valor: number
  categoria: Categoria
  formaPagamento?: FormaPagamento
  data?: string
  recorrente?: boolean
  frequencia?: FrequenciaRecorrencia
  ocorrenciasRegistradas?: string[]
}
