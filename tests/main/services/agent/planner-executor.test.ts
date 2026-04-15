import { describe, expect, it, vi } from 'vitest'
import { runPlannerExecutor } from '../../../../src/main/services/agent/planner-executor'
import { createAgentTools } from '../../../../src/main/services/agent/tools'
import type { AIToolCall } from '../../../../src/main/services/ai/provider'

function makeToolCall(name: string, argumentsJson: string, id = `${name}-1`): AIToolCall {
  return {
    id,
    type: 'function',
    function: {
      name: name as any,
      arguments: argumentsJson
    }
  }
}

describe('planner executor', () => {
  it('stops when a final answer is produced', async () => {
    const chatWithTools = vi
      .fn()
      .mockResolvedValueOnce({
        content: '',
        finishReason: 'tool_calls',
        toolCalls: [makeToolCall('get_profile', '{}', 'call_1')]
      })
      .mockResolvedValueOnce({
        content: 'done',
        finishReason: 'stop',
        toolCalls: []
      })

    const tools = createAgentTools({
      extractJobPage: vi.fn(),
      getProfile: vi.fn().mockReturnValue({
        resumeText: 'resume',
        selfIntroText: 'intro'
      }),
      saveBattleCard: vi.fn()
    })

    const result = await runPlannerExecutor({
      request: {
        requestId: 'req-1',
        userInstruction: 'generate a battle card',
        webContentId: 11
      },
      provider: { chatWithTools } as any,
      tools,
      maxSteps: 6
    })

    expect(result.finalAnswer).toBe('done')
    expect(result.trace.toolCalls).toHaveLength(1)
    expect(chatWithTools).toHaveBeenCalledTimes(2)
  })

  it('compresses extract_job_page content after the first tool step', async () => {
    const longContent = 'FULL_HTML_CONTENT_'.repeat(200)
    const snapshots: Array<Array<{ role: string; content: string }>> = []
    const responses = [
      {
        content: '',
        finishReason: 'tool_calls',
        toolCalls: [makeToolCall('extract_job_page', '{"webContentId":11}', 'call_1')]
      },
      {
        content: '',
        finishReason: 'tool_calls',
        toolCalls: [makeToolCall('extract_job_page', '{"webContentId":11}', 'call_2')]
      },
      {
        content: 'done',
        finishReason: 'stop',
        toolCalls: []
      }
    ]
    const chatWithTools = vi.fn().mockImplementation(async (messages) => {
      snapshots.push(JSON.parse(JSON.stringify(messages)))
      return responses.shift()!
    })

    const tools = createAgentTools({
      extractJobPage: vi.fn().mockResolvedValue({
        url: 'https://example.com/job',
        title: 'Acme - Agent',
        companyName: 'Acme',
        positionName: 'Agent',
        salaryRange: '30K-40K',
        requirementsSummary: 'TypeScript',
        content: longContent,
        pageType: 'jd',
        timestamp: 1,
        source: 'readability'
      }),
      getProfile: vi.fn().mockReturnValue({
        resumeText: 'resume',
        selfIntroText: 'intro'
      }),
      saveBattleCard: vi.fn()
    })

    const result = await runPlannerExecutor({
      request: {
        requestId: 'req-2',
        userInstruction: 'inspect job page',
        webContentId: 11
      },
      provider: { chatWithTools } as any,
      tools,
      maxSteps: 6
    })

    expect(result.finalAnswer).toBe('done')

    const secondCallMessages = snapshots[1]
    const firstToolMessage = [...secondCallMessages].reverse().find((message) => message.role === 'tool')
    expect(firstToolMessage).toBeDefined()
    const firstPayload = JSON.parse(firstToolMessage!.content)
    expect(firstPayload.toolName).toBe('extract_job_page')
    expect(firstPayload.contentSnippet).toBeDefined()
    expect(firstPayload.content).toBeDefined()
    expect(firstPayload.contentDropped).toBe(false)

    const thirdCallMessages = snapshots[2]
    const secondToolMessage = [...thirdCallMessages].reverse().find((message) => message.role === 'tool')
    expect(secondToolMessage).toBeDefined()
    const secondPayload = JSON.parse(secondToolMessage!.content)
    expect(secondPayload.toolName).toBe('extract_job_page')
    expect(secondPayload.contentSnippet).toBeDefined()
    expect(secondPayload.content).toBeUndefined()
    expect(secondPayload.contentDropped).toBe(true)
  })

  it('circuits out after repeated identical tool calls', async () => {
    const chatWithTools = vi
      .fn()
      .mockResolvedValueOnce({
        content: '',
        finishReason: 'tool_calls',
        toolCalls: [makeToolCall('get_profile', '{}', 'call_1')]
      })
      .mockResolvedValueOnce({
        content: '',
        finishReason: 'tool_calls',
        toolCalls: [makeToolCall('get_profile', '{}', 'call_2')]
      })
      .mockResolvedValueOnce({
        content: '',
        finishReason: 'tool_calls',
        toolCalls: [makeToolCall('get_profile', '{}', 'call_3')]
      })

    const getProfile = vi.fn().mockReturnValue({
      resumeText: 'resume',
      selfIntroText: 'intro'
    })

    const tools = createAgentTools({
      extractJobPage: vi.fn(),
      getProfile,
      saveBattleCard: vi.fn()
    })

    const result = await runPlannerExecutor({
      request: {
        requestId: 'req-3',
        userInstruction: 'retry loop',
        webContentId: 11
      },
      provider: { chatWithTools } as any,
      tools,
      maxSteps: 6
    })

    expect(getProfile).toHaveBeenCalledTimes(2)
    expect(result.trace.errors.some((item) => item.includes('CIRCUIT_BREAKER'))).toBe(true)
    expect(result.finalAnswer).toContain('重复工具调用')
  })
})
