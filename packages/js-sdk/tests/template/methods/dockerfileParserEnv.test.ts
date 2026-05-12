import { describe, it, assert } from 'vitest'
import { Template } from '../../../src'
import { InstructionType } from '../../../src/template/types'

/**
 * Helper to extract ENV instructions from a parsed Dockerfile.
 * Returns an array of Record<string, string> — one per ENV instruction.
 */
function getEnvs(dockerfileContent: string): Record<string, string>[] {
  const template = Template().fromDockerfile(dockerfileContent)
  // @ts-expect-error - instructions is not a property of TemplateBuilder
  const instructions = template.instructions as {
    type: InstructionType
    args: string[]
  }[]
  const envInstructions = instructions.filter(
    (i) => i.type === InstructionType.ENV
  )
  return envInstructions.map((inst) => {
    const result: Record<string, string> = {}
    for (let i = 0; i < inst.args.length; i += 2) {
      result[inst.args[i]] = inst.args[i + 1]
    }
    return result
  })
}

describe('dockerfileParser ENV handling', () => {
  describe('quote stripping', () => {
    it('strips double quotes from ENV values', () => {
      const envs = getEnvs('FROM node:24\nENV GOPATH="/go"')
      assert.deepEqual(envs, [{ GOPATH: '/go' }])
    })

    it('strips single quotes from ENV values', () => {
      const envs = getEnvs("FROM node:24\nENV GOPATH='/go'")
      assert.deepEqual(envs, [{ GOPATH: '/go' }])
    })

    it('does not strip mismatched quotes', () => {
      const envs = getEnvs('FROM node:24\nENV GOPATH="/go\'')
      assert.deepEqual(envs, [{ GOPATH: '"/go\'' }])
    })

    it('handles unquoted values', () => {
      const envs = getEnvs('FROM node:24\nENV GOPATH=/go')
      assert.deepEqual(envs, [{ GOPATH: '/go' }])
    })

    it('preserves variable references as-is (expansion done by backend)', () => {
      const envs = getEnvs(
        'FROM node:24\nENV GOPATH=/go\nENV PATH="/usr/bin:${GOPATH}/bin"'
      )
      assert.deepEqual(envs, [
        { GOPATH: '/go' },
        { PATH: '/usr/bin:${GOPATH}/bin' },
      ])
    })

    it('strips quotes from multiple key=value pairs', () => {
      const envs = getEnvs('FROM node:24\nENV A="hello" B="world"')
      assert.deepEqual(envs, [{ A: 'hello', B: 'world' }])
    })
  })

  describe('ARG handling', () => {
    it('ARG with default value', () => {
      const envs = getEnvs('FROM node:24\nARG MY_ARG="hello"')
      assert.deepEqual(envs, [{ MY_ARG: 'hello' }])
    })

    it('ARG without default sets empty value', () => {
      const envs = getEnvs('FROM node:24\nARG MY_ARG')
      assert.deepEqual(envs, [{ MY_ARG: '' }])
    })
  })
})
