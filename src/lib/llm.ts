import 'openai/shims/node'
import OpenAI from 'openai'
import { demoCache } from './cache'
import { truncateString } from './utils'

interface LLMOptions {
  timeout?: number
  useCache?: boolean
  simulateFailure?: boolean
}

interface LLMResponse {
  success: boolean
  content?: string
  error?: string
  fromCache?: boolean
  duration: number
}

export class LLMService {
  private openai: OpenAI
  private defaultTimeout: number

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
    this.defaultTimeout = parseInt(
      process.env.DEMO_LLM_TIMEOUT_MS || '5000'
    )
  }

  async generateInsight(
    data: any,
    prompt: string,
    options: LLMOptions = {}
  ): Promise<LLMResponse> {
    const startTime = Date.now()
    const {
      timeout = this.defaultTimeout,
      useCache = true,
      simulateFailure = process.env.SIMULATE_LLM_FAILURE === 'true',
    } = options

    if (simulateFailure) {
      return {
        success: false,
        error: 'Simulated LLM failure for demo purposes',
        duration: Date.now() - startTime,
      }
    }

    const cacheKey = `llm:${this.hashPrompt(prompt, data)}`

    if (useCache) {
      const cached = await demoCache.get<string>(cacheKey)
      if (cached) {
        return {
          success: true,
          content: cached,
          fromCache: true,
          duration: Date.now() - startTime,
        }
      }
    }

    try {
      const completion = await Promise.race([
        this.openai.chat.completions.create({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are an expert data analyst and marketing researcher. Analyze the provided data and generate actionable insights about how the data applies to the users marketing strategy. Focus on key trends, anomalies, and recommendations.`,
            },
            {
              role: 'user',
              content: `${prompt}\n\nData: ${JSON.stringify(data, null, 2)}`,
            },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM request timeout')), timeout)
        ),
      ])

      const content = completion.choices[0]?.message?.content || ''

      if (useCache && content) {
        await demoCache.set(cacheKey, content)
      }

      return {
        success: true,
        content,
        fromCache: false,
        duration: Date.now() - startTime,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      return {
        success: false,
        error: truncateString(errorMessage, 200),
        duration: Date.now() - startTime,
      }
    }
  }

  generateFallbackSummary(data: any): string {
    const fallbacks = [
      'Data analysis completed with standard statistical methods.',
      'Report generated using cached baseline calculations.',
      'Summary created from historical trend analysis.',
      'Insights derived from predefined analytical patterns.',
    ]
    
    return fallbacks[Math.floor(Math.random() * fallbacks.length)]
  }

  private hashPrompt(prompt: string, data: any): string {
    const combined = prompt + JSON.stringify(data)
    let hash = 0
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return Math.abs(hash).toString(36)
  }
}

export const llmService = new LLMService()