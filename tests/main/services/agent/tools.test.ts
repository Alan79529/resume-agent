import { describe, expect, it, vi } from 'vitest'
import { createAgentTools } from '../../../../src/main/services/agent/tools'

describe('agent tools', () => {
  it('exposes the fixed tool whitelist and rejects unknown tools', async () => {
    const tools = createAgentTools({
      extractJobPage: vi.fn(),
      getProfile: vi.fn(),
      saveBattleCard: vi.fn()
    })

    expect(tools.definitions.map((item) => item.function.name)).toEqual([
      'extract_job_page',
      'get_profile',
      'save_battle_card'
    ])

    const result = await tools.execute({ name: 'unknown_tool', argumentsJson: '{}' })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errorCode).toBe('TOOL_NOT_ALLOWED')
    }
  })

  it('returns a reduced profile payload', async () => {
    const tools = createAgentTools({
      extractJobPage: vi.fn(),
      getProfile: vi.fn().mockReturnValue({
        resumeText: 'resume '.repeat(300),
        selfIntroText: 'intro '.repeat(200)
      }),
      saveBattleCard: vi.fn()
    })

    const result = await tools.execute({ name: 'get_profile', argumentsJson: '{}' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.hasResume).toBe(true)
      expect(result.data.resumeTextSnippet.length).toBeLessThanOrEqual(1200)
      expect(result.data.selfIntroTextSnippet.length).toBeLessThanOrEqual(600)
    }
  })

  it('sanitizes save_battle_card input before persisting', async () => {
    const saveBattleCard = vi.fn().mockResolvedValue({
      cardId: 'card_1',
      companyName: 'Acme',
      positionName: 'Agent'
    })

    const tools = createAgentTools({
      extractJobPage: vi.fn(),
      getProfile: vi.fn(),
      saveBattleCard
    })

    const result = await tools.execute({
      name: 'save_battle_card',
      argumentsJson: JSON.stringify({
        companyName: '  Acme  ',
        positionName: '  Agent  ',
        sourceUrl: 'https://example.com/job',
        companyLocation: '  Shanghai  ',
        analysis: {
          companySummary: 'summary',
          jdSummary: 'jd',
          experienceSummary: 'exp',
          commonQuestions: [],
          warnings: [],
          checklist: [],
          selfIntroduction: '',
          resumeSuggestions: [],
          keyPoints: [],
          missingSkills: [],
          matchSuggestions: []
        }
      })
    })

    expect(result.ok).toBe(true)
    expect(saveBattleCard).toHaveBeenCalledTimes(1)
    expect(saveBattleCard).toHaveBeenCalledWith(
      expect.objectContaining({
        companyName: 'Acme',
        positionName: 'Agent',
        sourceUrl: 'https://example.com/job',
        companyLocation: 'Shanghai'
      })
    )
    if (result.ok) {
      expect(result.data.cardId).toBe('card_1')
      expect(result.data.companyName).toBe('Acme')
      expect(result.data.positionName).toBe('Agent')
    }
  })
})
