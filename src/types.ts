export const CATEGORIAS = [
  "alimento",
  "transporte",
  "lazer",
  "saúde",
  "outros",
] as const

export type Categoria = (typeof CATEGORIAS)[number]

export type Despesa = {
  id: string
  titulo: string
  valor: number
  categoria: Categoria
}
