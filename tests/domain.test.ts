import assert from "node:assert/strict"
import test from "node:test"
import {
  analisarImportacaoCsv,
  calcularOcorrenciasPrevistas,
  criarBackupExportado,
  ehBackup,
  ehDataValida,
  ehDespesa,
  interpretarDespesasArmazenadas,
  salvarBackupImportado,
  somarDespesas,
  somarValores,
  type ArmazenamentoBackup,
  type Backup,
  type ChavesBackup,
} from "../src/domain.ts"
import type { Despesa } from "../src/types.ts"

const chaves: ChavesBackup = {
  despesas: "despesas",
  metaMensal: "meta",
  limitesCategoria: "limites",
}

function criarDespesa(overrides: Partial<Despesa> = {}): Despesa {
  return {
    id: "despesa-1",
    titulo: "Conta",
    valor: 10,
    categoria: "outros",
    data: "2026-01-31",
    ...overrides,
  }
}

function criarBackup(overrides: Partial<Backup> = {}): Backup {
  return {
    formato: "painel-de-despesas",
    versao: 1,
    despesas: [criarDespesa()],
    metaMensal: 100,
    limitesCategoria: { outros: 50 },
    ...overrides,
  }
}

class ArmazenamentoEmMemoria implements ArmazenamentoBackup {
  readonly valores = new Map<string, string>()
  falharAoGravar?: (chave: string, valor: string, tentativa: number) => boolean
  private tentativasDeGravacao = 0

  getItem(chave: string): string | null {
    return this.valores.get(chave) ?? null
  }

  setItem(chave: string, valor: string): void {
    this.tentativasDeGravacao += 1
    if (
      this.falharAoGravar?.(chave, valor, this.tentativasDeGravacao)
    ) {
      throw new Error("Falha simulada de armazenamento")
    }
    this.valores.set(chave, valor)
  }

  removeItem(chave: string): void {
    this.valores.delete(chave)
  }
}

function criarArmazenamentoAnterior(): ArmazenamentoEmMemoria {
  const armazenamento = new ArmazenamentoEmMemoria()
  armazenamento.valores.set(chaves.despesas, '[{"id":"anterior"}]')
  armazenamento.valores.set(chaves.metaMensal, "250")
  armazenamento.valores.set(chaves.limitesCategoria, '{"lazer":80}')
  return armazenamento
}

test("soma valores em centavos sem erro de ponto flutuante", () => {
  assert.equal(somarValores([0.1, 0.2, 0.3]), 0.6)
  assert.equal(somarValores([]), 0)
})

test("calcula total mensal e por categoria excluindo outros meses", () => {
  const despesas = [
    criarDespesa({ valor: 0.1, data: "2026-03-01", categoria: "alimento" }),
    criarDespesa({ id: "2", valor: 0.2, data: "2026-03-31", categoria: "alimento" }),
    criarDespesa({ id: "3", valor: 50, data: "2026-03-10", categoria: "transporte" }),
    criarDespesa({ id: "4", valor: 100, data: "2026-04-01", categoria: "alimento" }),
  ]

  assert.equal(somarDespesas(despesas, { mes: "2026-03" }), 50.3)
  assert.equal(
    somarDespesas(despesas, { mes: "2026-03", categoria: "alimento" }),
    0.3,
  )
})

test("analisa CSV brasileiro, preserva campos citados e detecta duplicatas", () => {
  const csv = [
    '"Título";"Valor";"Categoria";"Forma de pagamento";"Data"',
    '"Mercado; Centro";"R$ 1.234,56";"Alimento";"Pix";"06/11/2026"',
    '"Conta";"10,00";"Outros";"Não informado";"31/01/2026"',
    '"Linha inválida";"0";"Outros";"Pix";"31/02/2026"',
  ].join("\r\n")

  const resultado = analisarImportacaoCsv(csv, [criarDespesa()])

  assert.equal(resultado.validas.length, 1)
  assert.deepEqual(resultado.validas[0], {
    linha: 2,
    despesa: {
      titulo: "Mercado; Centro",
      valor: 1234.56,
      categoria: "alimento",
      formaPagamento: "pix",
      data: "2026-11-06",
    },
  })
  assert.deepEqual(
    resultado.duplicadas.map(({ linha }) => linha),
    [3],
  )
  assert.deepEqual(
    resultado.invalidas.map(({ linha }) => linha),
    [4],
  )
})

test("analisa CSV separado por vírgula e rejeita cabeçalho incompatível", () => {
  const resultado = analisarImportacaoCsv(
    '\uFEFFtitle,value,category,date\n"Almoço",12.5,lazer,2026-11-06\nExtra,10,lazer,2026-11-06,unexpected',
  )
  assert.equal(resultado.validas[0]?.despesa.valor, 12.5)
  assert.equal(resultado.validas[0]?.despesa.formaPagamento, undefined)
  assert.deepEqual(
    resultado.invalidas.map(({ linha }) => linha),
    [3],
  )

  const csvIncompativel = analisarImportacaoCsv("Nome;Total\nConta;10")
  assert.equal(csvIncompativel.validas.length, 0)
  assert.match(csvIncompativel.invalidas[0]?.motivo ?? "", /Cabeçalho incompatível/)
})

test("valida datas ISO e brasileiras e rejeita datas impossíveis", () => {
  assert.equal(ehDataValida("2024-02-29"), true)
  assert.equal(ehDataValida("29-02-2024"), true)
  assert.equal(ehDataValida("2025-02-29"), false)
  assert.equal(ehDataValida("31-04-2026"), false)
})

test("rejeita data ausente em tipo inválido e mantém data opcional", () => {
  assert.equal(ehDespesa(criarDespesa({ data: undefined })), true)
  assert.equal(ehDespesa({ ...criarDespesa(), data: 20260131 }), false)
  assert.equal(ehDespesa({ ...criarDespesa(), data: "2026-02-30" }), false)
})

test("detecta dados de despesas inválidos sem descartar os registros reconhecidos", () => {
  assert.deepEqual(interpretarDespesasArmazenadas(null), {
    despesas: [],
    corrompido: false,
  })
  assert.deepEqual(interpretarDespesasArmazenadas("{"), {
    despesas: [],
    corrompido: true,
  })
  assert.deepEqual(
    interpretarDespesasArmazenadas(
      JSON.stringify([criarDespesa(), { id: "invalida" }]),
    ),
    { despesas: [criarDespesa()], corrompido: true },
  )
  assert.deepEqual(
    interpretarDespesasArmazenadas(
      JSON.stringify({ despesas: [criarDespesa()] }),
    ),
    { despesas: [criarDespesa()], corrompido: false },
  )
  assert.deepEqual(interpretarDespesasArmazenadas('"formato inválido"'), {
    despesas: [],
    corrompido: true,
  })
})

test("valida backups e mantém compatibilidade com backups sem limites", () => {
  const backupAntigo = criarBackup()
  delete backupAntigo.limitesCategoria
  assert.equal(ehBackup(backupAntigo), true)
  assert.equal(ehBackup(criarBackup()), true)

  assert.equal(
    ehBackup(criarBackup({ despesas: [criarDespesa(), criarDespesa()] })),
    false,
  )
  assert.equal(ehBackup(criarBackup({ metaMensal: -1 })), false)
  assert.equal(
    ehBackup({ ...criarBackup(), limitesCategoria: { categoria_invalida: 20 } }),
    false,
  )
  assert.equal(
    ehBackup({
      ...criarBackup(),
      despesas: [{ ...criarDespesa(), data: {} }],
    }),
    false,
  )
})

test("gera backup exportável que passa pela validação de importação", () => {
  const despesas = [criarDespesa()]
  const backup = criarBackupExportado(
    despesas,
    500,
    { outros: 100 },
    "2026-11-04T12:00:00.000Z",
  )

  assert.equal(backup.formato, "painel-de-despesas")
  assert.equal(backup.versao, 1)
  assert.equal(backup.exportadoEm, "2026-11-04T12:00:00.000Z")
  assert.equal(ehBackup(backup), true)
})

test("calcula recorrências mensais e ajusta dias ao fim do mês", () => {
  const despesa = criarDespesa({
    valor: 35.5,
    recorrente: true,
    frequencia: "mensal",
  })

  const ocorrencias = calcularOcorrenciasPrevistas([despesa], "2026-02-28")
  assert.deepEqual(
    ocorrencias.map(({ data }) => data),
    [
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
      "2026-06-30",
      "2026-07-31",
    ],
  )
})

test("prevê frequências trimestrais e anuais, omitindo ocorrências pagas", () => {
  const trimestral = criarDespesa({
    recorrente: true,
    frequencia: "trimestral",
    ocorrenciasRegistradas: ["2026-04-30"],
  })
  const anual = criarDespesa({
    id: "anual",
    titulo: "Seguro",
    data: "2025-04-30",
    recorrente: true,
    frequencia: "anual",
  })

  const ocorrencias = calcularOcorrenciasPrevistas(
    [trimestral, anual],
    "2026-02-01",
  )
  assert.deepEqual(
    ocorrencias.map(({ despesa, data }) => `${despesa.id}:${data}`),
    [
      "anual:2026-04-30",
      "despesa-1:2026-07-31",
    ],
  )
})

test("importa todas as partes do backup, removendo limites ausentes", () => {
  const armazenamento = criarArmazenamentoAnterior()
  const backup = criarBackup()
  delete backup.limitesCategoria

  assert.equal(salvarBackupImportado(armazenamento, chaves, backup), "salvo")
  assert.equal(
    armazenamento.getItem(chaves.despesas),
    JSON.stringify(backup.despesas),
  )
  assert.equal(armazenamento.getItem(chaves.metaMensal), "100")
  assert.equal(armazenamento.getItem(chaves.limitesCategoria), "{}")
})

test("restaura dados anteriores se uma gravação do backup falhar", () => {
  const armazenamento = criarArmazenamentoAnterior()
  const valoresAnteriores = new Map(armazenamento.valores)
  armazenamento.falharAoGravar = (_chave, _valor, tentativa) =>
    tentativa === 2

  assert.equal(
    salvarBackupImportado(armazenamento, chaves, criarBackup()),
    "falhou",
  )
  assert.deepEqual(armazenamento.valores, valoresAnteriores)
})

test("sinaliza falha parcial quando também não consegue restaurar", () => {
  const armazenamento = criarArmazenamentoAnterior()
  armazenamento.falharAoGravar = (_chave, _valor, tentativa) =>
    tentativa === 2 || tentativa === 3

  assert.equal(
    salvarBackupImportado(armazenamento, chaves, criarBackup()),
    "falhou-parcial",
  )
})
