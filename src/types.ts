export const CATEGORIAS = [
  "alimento",
  "transporte",
  "lazer",
  "saúde",
  "outros",
] as const

export const FREQUENCIAS = ["mensal", "trimestral", "anual"] as const

export type Categoria = (typeof CATEGORIAS)[number]
export type FrequenciaRecorrencia = (typeof FREQUENCIAS)[number]

export type Despesa = {
  id: string
  titulo: string
  valor: number
  categoria: Categoria
  data?: string
  recorrente?: boolean
  frequencia?: FrequenciaRecorrencia
  ocorrenciasRegistradas?: string[]
}
