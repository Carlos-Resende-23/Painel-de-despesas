import {
  CATEGORIAS,
  FREQUENCIAS,
  FORMAS_PAGAMENTO,
  type Categoria,
  type Despesa,
  type LimitesCategoria,
  type OrdenacaoDespesas,
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

export type LinhaImportacaoCsv = {
  linha: number
  despesa: Omit<Despesa, "id">
}

export type ProblemaImportacaoCsv = {
  linha: number
  motivo: string
}

export type ResultadoImportacaoCsv = {
  validas: LinhaImportacaoCsv[]
  duplicadas: ProblemaImportacaoCsv[]
  invalidas: ProblemaImportacaoCsv[]
}

export type ResultadoCarregamentoDespesas = {
  despesas: Despesa[]
  corrompido: boolean
}

type RegistroCsv = {
  linha: number
  campos: string[]
  malformado: boolean
}

function normalizarCabecalhoCsv(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]/g, "")
}

function detectarSeparadorCsv(conteudo: string): string {
  let aspas = false
  const contagens = new Map<string, number>([
    [";", 0],
    [",", 0],
    ["\t", 0],
  ])

  for (let indice = 0; indice < conteudo.length; indice += 1) {
    const caractere = conteudo[indice]
    if (caractere === '"') {
      if (aspas && conteudo[indice + 1] === '"') {
        indice += 1
      } else {
        aspas = !aspas
      }
    } else if (!aspas && (caractere === "\r" || caractere === "\n")) {
      break
    } else if (!aspas && contagens.has(caractere)) {
      contagens.set(caractere, (contagens.get(caractere) ?? 0) + 1)
    }
  }

  return [...contagens].sort((a, b) => b[1] - a[1])[0][0]
}

function lerRegistrosCsv(conteudo: string, separador: string): RegistroCsv[] {
  const registros: RegistroCsv[] = []
  let campos: string[] = []
  let campo = ""
  let aspas = false
  let malformado = false
  let linha = 1
  let linhaDoRegistro = 1

  const concluirCampo = () => {
    campos.push(campo)
    campo = ""
  }
  const concluirRegistro = () => {
    concluirCampo()
    if (campos.some((valor) => valor.trim()) || malformado) {
      registros.push({ linha: linhaDoRegistro, campos, malformado })
    }
    campos = []
    malformado = false
    linhaDoRegistro = linha + 1
  }

  for (let indice = 0; indice < conteudo.length; indice += 1) {
    const caractere = conteudo[indice]
    if (caractere === '"') {
      if (aspas && conteudo[indice + 1] === '"') {
        campo += '"'
        indice += 1
      } else if (aspas || campo.length === 0) {
        aspas = !aspas
      } else {
        malformado = true
        campo += caractere
      }
      continue
    }

    if (!aspas && caractere === separador) {
      concluirCampo()
      continue
    }

    if (!aspas && (caractere === "\r" || caractere === "\n")) {
      concluirRegistro()
      if (caractere === "\r" && conteudo[indice + 1] === "\n") {
        indice += 1
      }
      linha += 1
      linhaDoRegistro = linha
      continue
    }

    if (caractere === "\n") linha += 1
    campo += caractere
  }

  if (aspas) malformado = true
  if (campos.length > 0 || campo.length > 0 || malformado) {
    concluirRegistro()
  }
  return registros
}

function converterValorCsv(valor: string): number | undefined {
  let normalizado = valor
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\s/g, "")
  if (!normalizado) return undefined

  const ultimaVirgula = normalizado.lastIndexOf(",")
  const ultimoPonto = normalizado.lastIndexOf(".")
  if (ultimaVirgula >= 0 && ultimoPonto >= 0) {
    normalizado =
      ultimaVirgula > ultimoPonto
        ? normalizado.replace(/\./g, "").replace(",", ".")
        : normalizado.replace(/,/g, "")
  } else if (ultimaVirgula >= 0) {
    normalizado = normalizado.replace(",", ".")
  }

  if (!/^\+?\d+(?:\.\d+)?$/.test(normalizado)) return undefined
  const valorNumerico = Number(normalizado)
  return Number.isFinite(valorNumerico) && valorNumerico > 0
    ? Math.round(valorNumerico * 100) / 100
    : undefined
}

function converterDataCsv(valor: string): string | undefined {
  const data = valor.trim()
  let dataISO = data
  const dataBrasileira = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(data)
  if (dataBrasileira) {
    dataISO = `${dataBrasileira[3]}-${dataBrasileira[2]}-${dataBrasileira[1]}`
  }
  return ehDataValida(dataISO) && /^\d{4}-\d{2}-\d{2}$/.test(dataISO)
    ? dataISO
    : undefined
}

function chaveDespesaImportada(despesa: Omit<Despesa, "id"> | Despesa): string {
  return [
    despesa.titulo.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR"),
    Math.round(despesa.valor * 100),
    despesa.categoria,
    despesa.formaPagamento ?? "",
    converterDataCsv(despesa.data ?? "") ?? despesa.data ?? "",
  ].join("|")
}

function normalizarTextoDespesa(valor: string): string {
  return valor
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
}

export function encontrarDespesaDuplicada(
  despesas: readonly Despesa[],
  candidata: Pick<
    Despesa,
    "titulo" | "valor" | "categoria" | "formaPagamento" | "data"
  >,
  idIgnorado?: string,
): Despesa | undefined {
  const chaveCandidata = [
    normalizarTextoDespesa(candidata.titulo),
    Math.round(candidata.valor * 100),
    candidata.categoria,
    candidata.formaPagamento ?? "",
    normalizarData(candidata.data, dataISOlocal(new Date())) ?? "",
  ].join("|")

  for (const despesa of despesas) {
    if (idIgnorado && despesa.id === idIgnorado) continue

    const chaveAtual = [
      normalizarTextoDespesa(despesa.titulo),
      Math.round(despesa.valor * 100),
      despesa.categoria,
      despesa.formaPagamento ?? "",
      normalizarData(despesa.data, dataISOlocal(new Date())) ?? "",
    ].join("|")

    if (chaveAtual === chaveCandidata) {
      return despesa
    }
  }

  return undefined
}

export function analisarImportacaoCsv(
  conteudo: string,
  despesasExistentes: readonly Despesa[] = [],
): ResultadoImportacaoCsv {
  const texto = conteudo.replace(/^\uFEFF/, "")
  const registros = lerRegistrosCsv(texto, detectarSeparadorCsv(texto))
  const resultado: ResultadoImportacaoCsv = {
    validas: [],
    duplicadas: [],
    invalidas: [],
  }
  const cabecalho = registros.shift()

  if (!cabecalho || cabecalho.malformado) {
    resultado.invalidas.push({
      linha: cabecalho?.linha ?? 1,
      motivo: "Cabeçalho ausente ou CSV malformado.",
    })
    return resultado
  }

  const indices = new Map<string, number>()
  cabecalho.campos.forEach((campo, indice) => {
    const nome = normalizarCabecalhoCsv(campo)
    if (nome === "titulo" || nome === "title" || nome === "descricao") {
      indices.set("titulo", indice)
    } else if (nome === "valor" || nome === "value" || nome === "amount") {
      indices.set("valor", indice)
    } else if (nome === "categoria" || nome === "category") {
      indices.set("categoria", indice)
    } else if (
      nome === "formadepagamento" ||
      nome === "pagamento" ||
      nome === "paymentmethod"
    ) {
      indices.set("pagamento", indice)
    } else if (nome === "data" || nome === "date") {
      indices.set("data", indice)
    }
  })

  const colunasObrigatorias = ["titulo", "valor", "categoria", "data"]
  const ausentes = colunasObrigatorias.filter((coluna) => !indices.has(coluna))
  if (ausentes.length > 0) {
    resultado.invalidas.push({
      linha: cabecalho.linha,
      motivo: `Cabeçalho incompatível. Colunas obrigatórias: título, valor, categoria e data.`,
    })
    return resultado
  }

  const categorias: Record<string, Categoria> = {
    alimento: "alimento",
    transporte: "transporte",
    lazer: "lazer",
    saude: "saúde",
    outros: "outros",
  }
  const formasPagamento: Record<string, Despesa["formaPagamento"]> = {
    pix: "pix",
    credito: "credito",
    debito: "debito",
    dinheiro: "dinheiro",
    naoinformado: undefined,
  }
  const chavesExistentes = new Set(
    despesasExistentes.map(chaveDespesaImportada),
  )

  for (const registro of registros) {
    if (registro.malformado) {
      resultado.invalidas.push({
        linha: registro.linha,
        motivo: "Linha CSV malformada ou com aspas sem par.",
      })
      continue
    }
    if (registro.campos.length !== cabecalho.campos.length) {
      resultado.invalidas.push({
        linha: registro.linha,
        motivo: "Quantidade de colunas diferente do cabeçalho.",
      })
      continue
    }

    const valorCampo = (nome: string) =>
      registro.campos[indices.get(nome) ?? -1]?.trim() ?? ""
    const titulo = valorCampo("titulo")
    const valor = converterValorCsv(valorCampo("valor"))
    const categoria =
      categorias[normalizarCabecalhoCsv(valorCampo("categoria"))]
    const data = converterDataCsv(valorCampo("data"))
    const pagamentoCampo = valorCampo("pagamento")
    const formaPagamento = pagamentoCampo
      ? formasPagamento[normalizarCabecalhoCsv(pagamentoCampo)]
      : undefined
    const pagamentoValido =
      !pagamentoCampo ||
      Object.prototype.hasOwnProperty.call(
        formasPagamento,
        normalizarCabecalhoCsv(pagamentoCampo),
      )

    if (!titulo || !valor || !categoria || !data || !pagamentoValido) {
      resultado.invalidas.push({
        linha: registro.linha,
        motivo: !titulo
          ? "Título obrigatório."
          : !valor
            ? "Valor inválido; informe um número maior que zero."
            : !categoria
              ? "Categoria inválida."
              : !data
                ? "Data inválida; use DD/MM/AAAA ou AAAA-MM-DD."
                : "Forma de pagamento inválida.",
      })
      continue
    }

    const despesa: Omit<Despesa, "id"> = {
      titulo,
      valor,
      categoria,
      formaPagamento,
      data,
    }
    const chave = chaveDespesaImportada(despesa)
    if (chavesExistentes.has(chave)) {
      resultado.duplicadas.push({
        linha: registro.linha,
        motivo: `Despesa duplicada: ${titulo}.`,
      })
      continue
    }

    chavesExistentes.add(chave)
    resultado.validas.push({ linha: registro.linha, despesa })
  }

  return resultado
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

export function ordenarDespesas(
  despesas: readonly Despesa[],
  ordenacao: OrdenacaoDespesas,
  hoje = dataISOlocal(new Date()),
): Despesa[] {
  return despesas
    .map((despesa, indice) => ({ despesa, indice }))
    .sort((a, b) => {
      let comparacao = 0

      switch (ordenacao) {
        case "recentes":
          comparacao = normalizarData(b.despesa.data, hoje).localeCompare(
            normalizarData(a.despesa.data, hoje),
          )
          break
        case "antigas":
          comparacao = normalizarData(a.despesa.data, hoje).localeCompare(
            normalizarData(b.despesa.data, hoje),
          )
          break
        case "maior-valor":
          comparacao = b.despesa.valor - a.despesa.valor
          break
        case "menor-valor":
          comparacao = a.despesa.valor - b.despesa.valor
          break
      }

      return comparacao || b.indice - a.indice
    })
    .map(({ despesa }) => despesa)
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
      FORMAS_PAGAMENTO.some((forma) => forma === registro.formaPagamento)) &&
    dataValida &&
    recorrenteValido &&
    frequenciaValida &&
    ocorrenciasRegistradasValidas
  )
}

export function interpretarDespesasArmazenadas(
  dados: string | null,
): ResultadoCarregamentoDespesas {
  if (dados === null) return { despesas: [], corrompido: false }

  let estado: unknown
  try {
    estado = JSON.parse(dados)
  } catch {
    return { despesas: [], corrompido: true }
  }

  let registros: unknown[]
  if (Array.isArray(estado)) {
    registros = estado
  } else if (
    typeof estado === "object" &&
    estado !== null &&
    Array.isArray((estado as { despesas?: unknown }).despesas)
  ) {
    registros = (estado as { despesas: unknown[] }).despesas
  } else {
    return { despesas: [], corrompido: true }
  }

  const despesas = registros.filter(ehDespesa)
  return {
    despesas,
    corrompido: despesas.length !== registros.length,
  }
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
      filtro.categoria === undefined || despesa.categoria === filtro.categoria
    return mesCorrespondente && categoriaCorrespondente
  })

  return somarValores(despesasFiltradas.map(({ valor }) => valor))
}

export type EvolucaoMensal = {
  mes: string
  total: number
}

export type VariacaoMensal = {
  mesAtual: string
  mesAnterior: string
  totalAtual: number
  totalAnterior: number
  diferenca: number
  percentual: number
  direcao: "aumento" | "queda" | "igual"
}

function construirSerieMensal(
  hoje: string,
  quantidadeMeses: number,
): Array<{ mes: string; total: number }> {
  const [anoAtual, mesAtual] = hoje.split("-").map(Number)
  const meses = Array.from({ length: quantidadeMeses }, (_, indice) => {
    const data = new Date(
      anoAtual,
      mesAtual - 1 - (quantidadeMeses - 1) + indice,
      1,
    )
    return {
      mes: dataISOlocal(data).slice(0, 7),
      total: 0,
    }
  })

  return meses
}

export function calcularEvolucaoMensal(
  despesas: readonly Despesa[],
  hoje = dataISOlocal(new Date()),
  quantidadeMeses = 6,
): EvolucaoMensal[] {
  const serie = construirSerieMensal(hoje, quantidadeMeses)
  const totais = new Map(serie.map((mes) => [mes.mes, mes]))

  for (const despesa of despesas) {
    const chaveMes = normalizarData(despesa.data, hoje).slice(0, 7)
    const mes = totais.get(chaveMes)
    if (mes) {
      mes.total = somarValores([mes.total, despesa.valor])
    }
  }

  return serie
}

export function calcularTendenciaMensal(
  despesas: readonly Despesa[],
  hoje = dataISOlocal(new Date()),
  quantidadeMeses = 6,
): EvolucaoMensal[] {
  return calcularEvolucaoMensal(despesas, hoje, quantidadeMeses)
}

export function calcularVariacaoMensal(
  despesas: readonly Despesa[],
  hoje = dataISOlocal(new Date()),
  quantidadeMeses = 6,
): VariacaoMensal | null {
  const evolucao = calcularEvolucaoMensal(despesas, hoje, quantidadeMeses)
  const mesAtual = evolucao.at(-1)
  const mesAnterior = evolucao.at(-2)

  if (!mesAtual || !mesAnterior) return null

  const totalAtual = mesAtual.total
  const totalAnterior = mesAnterior.total
  const diferenca = totalAtual - totalAnterior
  const percentual =
    totalAnterior === 0
      ? totalAtual === 0
        ? 0
        : 100
      : Number(((Math.abs(diferenca) / totalAnterior) * 100).toFixed(1))

  let direcao: VariacaoMensal["direcao"] = "igual"
  if (diferenca > 0) direcao = "aumento"
  else if (diferenca < 0) direcao = "queda"

  return {
    mesAtual: mesAtual.mes,
    mesAnterior: mesAnterior.mes,
    totalAtual,
    totalAnterior,
    diferenca,
    percentual,
    direcao,
  }
}

export const calcularComparacaoEvolucaoMensal = calcularVariacaoMensal
export const calcularEvolucao = calcularEvolucaoMensal
export const calcularTendencia = calcularEvolucaoMensal
export const obterEvolucaoMensal = calcularEvolucaoMensal
export const obterVariacaoMensal = calcularVariacaoMensal

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
    const ocorrenciasRegistradas = new Set(despesa.ocorrenciasRegistradas ?? [])

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
