import { afterEach, describe, expect, test, vi } from 'vitest'

const clack = vi.hoisted(() => {
  const CANCEL = Symbol('clack:cancel')
  return {
    CANCEL,
    isCancel: (value: unknown) => value === CANCEL,
    select: vi.fn(),
    text: vi.fn(),
    confirm: vi.fn(),
    cancel: vi.fn(),
  }
})
vi.mock('@clack/prompts', () => clack)

import { confirm, select, text } from '../../src/utils/prompts'

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('prompts', () => {
  test('return the answer', async () => {
    clack.select.mockResolvedValueOnce('b')
    clack.text.mockResolvedValueOnce('name')
    clack.confirm.mockResolvedValueOnce(true)

    expect(
      await select({
        message: 'Pick',
        options: [{ value: 'a' }, { value: 'b' }],
      })
    ).toBe('b')
    expect(await text({ message: 'Name' })).toBe('name')
    expect(await confirm('Sure?')).toBe(true)
    expect(clack.confirm).toHaveBeenCalledWith({
      message: 'Sure?',
      initialValue: false,
    })
  })

  const cases: [string, () => Promise<unknown>, typeof clack.select][] = [
    ['select', () => select({ message: 'Pick', options: [] }), clack.select],
    ['text', () => text({ message: 'Name' }), clack.text],
    ['confirm', () => confirm('Sure?'), clack.confirm],
  ]
  for (const [name, ask, prompt] of cases) {
    test(`${name} exits when canceled`, async () => {
      prompt.mockResolvedValueOnce(clack.CANCEL)
      const exit = vi.spyOn(process, 'exit').mockImplementation(((
        code?: number
      ) => {
        throw new Error(`exit ${code}`)
      }) as never)

      await expect(ask()).rejects.toThrow('exit 130')
      expect(clack.cancel).toHaveBeenCalledWith('Canceled')
      expect(exit).toHaveBeenCalledWith(130)
    })
  }
})
