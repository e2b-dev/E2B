import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import * as e2b from 'e2b'

import { resolveTemplateBuildName } from '../../../src/commands/template/resolveBuildName'
import { E2BConfig } from '../../../src/config'

const mockGet = vi.fn()

vi.mock('../../../src/api', () => ({
  client: {
    api: {
      GET: (...args: unknown[]) => mockGet(...args),
    },
  },
  resolveTeamId: vi.fn(),
}))

vi.mock('../../../src/user', () => ({
  getUserConfig: vi.fn(),
}))

import { getUserConfig } from '../../../src/user'

describe('resolveTemplateBuildName', () => {
  const baseConfig: E2BConfig = {
    template_id: 'abc1234567890xyz',
    dockerfile: 'e2b.Dockerfile',
  }

  beforeEach(() => {
    mockGet.mockReset()
    delete process.env.E2B_API_KEY
    vi.mocked(getUserConfig).mockReturnValue({ teamApiKey: 'test-api-key' } as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('prefers template_name from config', async () => {
    const name = await resolveTemplateBuildName({
      ...baseConfig,
      template_name: 'my-template',
    })

    expect(name).toBe('my-template')
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('uses --alias override when template_name is missing', async () => {
    const name = await resolveTemplateBuildName(baseConfig, {
      alias: 'cli-alias',
    })

    expect(name).toBe('cli-alias')
    expect(mockGet).not.toHaveBeenCalled()
  })

  test('resolves alias from API when only template_id is present', async () => {
    mockGet.mockResolvedValue({
      data: {
        templateID: baseConfig.template_id,
        names: ['my-template', 'my-template:prod'],
        aliases: ['legacy-alias'],
      } satisfies Pick<
        e2b.components['schemas']['TemplateWithBuilds'],
        'templateID' | 'names' | 'aliases'
      >,
    })

    const name = await resolveTemplateBuildName(baseConfig)

    expect(name).toBe('my-template')
    expect(mockGet).toHaveBeenCalledWith('/templates/{templateID}', {
      params: {
        path: { templateID: baseConfig.template_id },
        query: { limit: 1 },
      },
    })
  })

  test('falls back to template_id when API lookup fails', async () => {
    mockGet.mockResolvedValue({
      error: { code: 404, message: 'not found' },
    })

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const name = await resolveTemplateBuildName(baseConfig)

    expect(name).toBe(baseConfig.template_id)
    expect(warnSpy).toHaveBeenCalled()
  })

  test('falls back to template_id without API call when unauthenticated', async () => {
    vi.mocked(getUserConfig).mockReturnValue(undefined)

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const name = await resolveTemplateBuildName(baseConfig)

    expect(name).toBe(baseConfig.template_id)
    expect(mockGet).not.toHaveBeenCalled()
    expect(warnSpy).toHaveBeenCalled()
  })

  test('uses deprecated aliases when names are empty', async () => {
    mockGet.mockResolvedValue({
      data: {
        templateID: baseConfig.template_id,
        names: [],
        aliases: ['legacy-alias'],
      },
    })

    const name = await resolveTemplateBuildName(baseConfig)

    expect(name).toBe('legacy-alias')
  })
})
