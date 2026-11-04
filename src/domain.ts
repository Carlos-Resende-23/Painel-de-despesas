import {
  CATEGORIAS,
  FREQUENCIAS,
  FORMAS_PAGAMENTO,
  type Categoria,
  type Despesa,
  type LimitesCategoria,
} from "./types.ts"

export type Backup = {
  formato: "painel-de-despesas"
  versao: 1
  despesas: Despesa[]
  metaMensal: number
  limitesCategoria?: LimitesCategoria
}

export type ChavesBackup = {
  despesas: string
  metaMensal: string
  limitesCategoria: string
}

export type ArmazenamentoBackup = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>

export type OcorrenciaPrevista = {
  despesa: Despesa
  data: string
}

export type FiltroSomaDespesas = {
  mes?: string
  categoria?: Categoria
}

function dataISOlocal(data: Date): string {
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, "0")
  const dia = String(data.getDate()).padStart(2, "0")
  return `${ano}-${mes}-${dia}`
}

function normalizarData(data: string | undefined, hoje: string): string {
  if (!data) return hoje
  if (/^\d{4}-\d{2}-\d{2}$/.test(data)) return data

  const dataBrasileira = /^(\d{2})-(\d{2})-(\d{4})$/.exec(data)
  if (dataBrasileira) {
    return `${dataBrasileira[3]}-${dataBrasileira[2]}-${dataBrasileira[1]}`
  }

  const dataConvertida = new Date(data)
  return Number.isNaN(dataConvertida.getTime())
    ? hoje
    : dataISOlocal(dataConvertida)
}

export function ehDataValida(data: string): boolean {
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

export function ehDespesa(valor: unknown): valor is Despesa {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    return false
  }

  const registro = valor as Record<string, unknown>
  const dataValida =
    typeof registro.data === "undefined" ||
    (typeof registro.data === "string" && ehDataValida(registro.data))
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
    (typeof registro.formaPagamento === "undefined" ||
      FORMAS_PAGAMENTO.some(
        (forma) => forma === registro.formaPagamento,
      )) &&
    dataValida &&
    recorrenteValido &&
    frequenciaValida &&
    ocorrenciasRegistradasValidas
  )
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

export function ehBackup(valor: unknown): valor is Backup {
  if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
    return false
  }

  const backup = valor as Record<string, unknown>
  if (
    backup.formato !== "painel-de-despesas" ||
    backup.versao !== 1 ||
    !Array.isArray(backup.despesas) ||
    typeof backup.metaMensal !== "number" ||
    !Number.isFinite(backup.metaMensal) ||
    backup.metaMensal < 0 ||
    (typeof backup.limitesCategoria !== "undefined" &&
      !ehLimitesCategoria(backup.limitesCategoria))
  ) {
    return false
  }

  const ids = new Set<string>()
  for (const despesa of backup.despesas) {
    if (!ehDespesa(despesa) || !despesa.id.trim() || ids.has(despesa.id)) {
      return false
    }
    ids.add(despesa.id)
  }

  return true
}

export function somarValores(valores: readonly number[]): number {
  const totalEmCentavos = valores.reduce(
    (total, valor) => total + Math.round(valor * 100),
    0,
  )
  return totalEmCentavos / 100
}

export function somarDespesas(
  despesas: readonly Despesa[],
  filtro: FiltroSomaDespesas = {},
): number {
  const hoje = dataISOlocal(new Date())
  const despesasFiltradas = despesas.filter((despesa) => {
    const mesCorrespondente =
      filtro.mes === undefined ||
      normalizarData(despesa.data, hoje).slice(0, 7) === filtro.mes
    const categoriaCorrespondente =
      filtro.categoria === undefined ||
      despesa.categoria === filtro.categoria
    return mesCorrespondente && categoriaCorrespondente
  })

  return somarValores(despesasFiltradas.map(({ valor }) => valor))
}

export function criarBackupExportado(
  despesas: Despesa[],
  metaMensal: number,
  limitesCategoria: LimitesCategoria,
  exportadoEm = new Date().toISOString(),
): Backup & { exportadoEm: string } {
  return {
    formato: "painel-de-despesas",
    versao: 1,
    exportadoEm,
    despesas,
    metaMensal,
    limitesCategoria,
  }
}

export function calcularOcorrenciasPrevistas(
  despesas: readonly Despesa[],
  hoje = dataISOlocal(new Date()),
): OcorrenciaPrevista[] {
  const [anoAtual, mesAtual] = hoje.split("-").map(Number)
  const mesAtualIndice = anoAtual * 12 + mesAtual - 1
  const ocorrencias: OcorrenciaPrevista[] = []

  for (const despesa of despesas) {
    if (!despesa.recorrente) continue

    const dataBase = normalizarData(despesa.data, hoje)
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
      const data = dataISOlocal(new Date(ano, mes, dia))

      if (data >= hoje && !ocorrenciasRegistradas.has(data)) {
        ocorrencias.push({ despesa, data })
      }
    }
  }

  return ocorrencias.sort(
    (a, b) =>
      a.data.localeCompare(b.data) ||
      a.despesa.titulo.localeCompare(b.despesa.titulo, "pt-BR"),
  )
}

function restaurarValorArmazenado(
  armazenamento: ArmazenamentoBackup,
  chave: string,
  valor: string | null,
): boolean {
  try {
    if (valor === null) {
      armazenamento.removeItem(chave)
    } else {
      armazenamento.setItem(chave, valor)
    }
    return true
  } catch {
    return false
  }
}

export function salvarBackupImportado(
  armazenamento: ArmazenamentoBackup,
  chaves: ChavesBackup,
  backup: Backup,
): "salvo" | "falhou" | "falhou-parcial" {
  let despesasAnteriores: string | null
  let metaAnterior: string | null
  let limitesAnteriores: string | null

  try {
    despesasAnteriores = armazenamento.getItem(chaves.despesas)
    metaAnterior = armazenamento.getItem(chaves.metaMensal)
    limitesAnteriores = armazenamento.getItem(chaves.limitesCategoria)
  } catch {
    return "falhou"
  }

  let despesasGravadas = false
  let metaGravada = false
  let limitesGravados = false
  try {
    armazenamento.setItem(chaves.despesas, JSON.stringify(backup.despesas))
    despesasGravadas = true
    armazenamento.setItem(chaves.metaMensal, String(backup.metaMensal))
    metaGravada = true
    armazenamento.setItem(
      chaves.limitesCategoria,
      JSON.stringify(backup.limitesCategoria ?? {}),
    )
    limitesGravados = true
    return "salvo"
  } catch {
    const despesasRestauradas =
      !despesasGravadas ||
      restaurarValorArmazenado(
        armazenamento,
        chaves.despesas,
        despesasAnteriores,
      )
    const metaRestaurada =
      !metaGravada ||
      restaurarValorArmazenado(armazenamento, chaves.metaMensal, metaAnterior)
    const limitesRestaurados =
      !limitesGravados ||
      restaurarValorArmazenado(
        armazenamento,
        chaves.limitesCategoria,
        limitesAnteriores,
      )
    return despesasRestauradas && metaRestaurada && limitesRestaurados
      ? "falhou"
      : "falhou-parcial"
  }
}
