import { readFile } from 'node:fs/promises'
import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type ToolCall = {
  name: string
  args?: Record<string, unknown>
}

type AgentEvalCase = {
  id: string
  input: {
    userInstruction: string
    webContentId: number
  }
  expected: {
    toolSequence: string[]
    mustFinish: boolean
    maxSteps: number
  }
  facts: {
    companyName: string
    positionName: string
    salary: string
  }
  observed?: {
    completed?: boolean
    steps?: number
    toolCalls?: ToolCall[]
    savedCard?: {
      companyName?: string
      positionName?: string
      salaryRange?: string
    }
    finalAnswer?: string
  }
}

type CaseResult = {
  id: string
  completed: boolean
  toolAccuracy: boolean
  steps: number
  stepsWithinLimit: boolean
  hallucinated: boolean
}

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[·|｜\-_()/\\,，。；;:："'`~!@#$%^&*+=?<>{}\[\]]/g, '')
}

function matchesSequence(actual: string[], expected: string[]): boolean {
  if (expected.length === 0) {
    return true
  }

  let expectedIndex = 0
  for (const name of actual) {
    if (normalizeText(name) === normalizeText(expected[expectedIndex])) {
      expectedIndex += 1
      if (expectedIndex === expected.length) {
        return true
      }
    }
  }

  return false
}

function calcHallucination(caseItem: AgentEvalCase): boolean {
  const savedCard = caseItem.observed?.savedCard
  if (!savedCard) {
    return false
  }

  const companyMismatch = normalizeText(savedCard.companyName) !== normalizeText(caseItem.facts.companyName)
  const positionMismatch = normalizeText(savedCard.positionName) !== normalizeText(caseItem.facts.positionName)
  const salaryMismatch = normalizeText(savedCard.salaryRange) !== normalizeText(caseItem.facts.salary)

  return companyMismatch || positionMismatch || salaryMismatch
}

function resolveSteps(caseItem: AgentEvalCase): number {
  if (typeof caseItem.observed?.steps === 'number') {
    return caseItem.observed.steps
  }

  return caseItem.observed?.toolCalls?.length ?? 0
}

async function loadCases(casesDir: string): Promise<AgentEvalCase[]> {
  const entries = await readdir(casesDir, { withFileTypes: true })
  const jsonFiles = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json'))

  const cases = await Promise.all(
    jsonFiles.map(async (entry) => {
      const fullPath = path.join(casesDir, entry.name)
      const raw = await readFile(fullPath, 'utf8')
      return JSON.parse(raw) as AgentEvalCase
    })
  )

  return cases.sort((left, right) => left.id.localeCompare(right.id))
}

async function main(): Promise<void> {
  const runnerDir = path.dirname(fileURLToPath(import.meta.url))
  const casesDir = path.join(runnerDir, 'cases')
  const cases = await loadCases(casesDir)

  const results: CaseResult[] = cases.map((caseItem) => {
    const toolCalls = caseItem.observed?.toolCalls ?? []
    const toolNames = toolCalls.map((toolCall) => toolCall.name)
    const toolAccuracy = matchesSequence(toolNames, caseItem.expected.toolSequence)
    const completed = Boolean(caseItem.observed?.completed)
    const steps = resolveSteps(caseItem)
    const hallucinated = calcHallucination(caseItem)
    const stepsWithinLimit =
      typeof caseItem.expected?.maxSteps === 'number'
        ? steps <= caseItem.expected.maxSteps
        : true

    return {
      id: caseItem.id,
      completed,
      toolAccuracy,
      steps,
      stepsWithinLimit,
      hallucinated
    }
  })

  const total = results.length
  const completionRate =
    total === 0
      ? 0
      : results.filter((item, index) => {
          const expectedMustFinish = Boolean(cases[index].expected?.mustFinish)
          return expectedMustFinish ? item.completed : true
        }).length / total
  const toolAccuracy = total === 0 ? 0 : results.filter((item) => item.toolAccuracy).length / total
  const avgSteps = total === 0 ? 0 : results.reduce((sum, item) => sum + item.steps, 0) / total
  const stepLimitPassRate = total === 0 ? 0 : results.filter((item) => item.stepsWithinLimit).length / total
  const hallucinationChecked = cases.filter((item) => item.observed?.savedCard).length
  const hallucinationRate =
    hallucinationChecked === 0
      ? 0
      : cases.filter((item) => calcHallucination(item)).length / hallucinationChecked

  const summary = {
    total,
    completionRate,
    toolAccuracy,
    avgSteps,
    stepLimitPassRate,
    hallucinationRate,
    results
  }

  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error('[eval:agent] Failed to run agent v2 eval harness:', error)
  process.exitCode = 1
})
