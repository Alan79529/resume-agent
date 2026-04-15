import { afterEach, describe, expect, it, vi } from 'vitest'
import { OpenAICompatibleProvider } from '../../../../src/main/services/ai/openai-compatible'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('OpenAICompatibleProvider.chatWithTools', () => {
  it('parses tool calls and includes tool request metadata', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              role: 'assistant',
              content: '',
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'extract_job_page',
                    arguments: '{"webContentId":123}'
                  }
                }
              ]
            }
          }
        ]
      })
    })

    vi.stubGlobal('fetch', fetchMock)

    const provider = new OpenAICompatibleProvider({
      baseURL: 'https://example.com/v1/chat/completions',
      model: 'gpt-4.1-mini',
      apiKey: 'test-key'
    })

    const result = await provider.chatWithTools(
      [{ role: 'user', content: 'go' }],
      [
        {
          type: 'function',
          function: {
            name: 'extract_job_page',
            description: 'extract job page',
            parameters: {
              type: 'object',
              properties: {
                webContentId: { type: 'number' }
              },
              required: ['webContentId']
            }
          }
        }
      ]
    )

    expect(result.finishReason).toBe('tool_calls')
    expect(result.content).toBe('')
    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0].function.name).toBe('extract_job_page')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    expect(body.tools).toHaveLength(1)
    expect(body.tools[0].function.name).toBe('extract_job_page')
    expect(body.tool_choice).toBe('auto')
  })

  it('falls back to plain assistant text when no tool calls are returned', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            finish_reason: 'stop',
            message: {
              role: 'assistant',
              content: 'final answer'
            }
          }
        ]
      })
    }))

    const provider = new OpenAICompatibleProvider({
      baseURL: 'https://example.com/v1/chat/completions',
      model: 'gpt-4.1-mini',
      apiKey: ''
    })

    const result = await provider.chatWithTools([{ role: 'user', content: 'hello' }], [])

    expect(result.finishReason).toBe('stop')
    expect(result.content).toBe('final answer')
    expect(result.toolCalls).toEqual([])
  })
})
