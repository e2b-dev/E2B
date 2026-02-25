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
  })

  describe('variable expansion', () => {
    it('expands ${VAR} references', () => {
      const envs = getEnvs(
        'FROM node:24\nENV GOPATH=/go\nENV PATH=/usr/bin:${GOPATH}/bin'
      )
      assert.deepEqual(envs, [{ GOPATH: '/go' }, { PATH: '/usr/bin:/go/bin' }])
    })

    it('expands $VAR references', () => {
      const envs = getEnvs(
        'FROM node:24\nENV GOPATH=/go\nENV PATH=/usr/bin:$GOPATH/bin'
      )
      assert.deepEqual(envs, [{ GOPATH: '/go' }, { PATH: '/usr/bin:/go/bin' }])
    })

    it('expands ${VAR:-default} with unset variable', () => {
      const envs = getEnvs('FROM node:24\nENV MY_VAR=${UNSET_VAR:-fallback}')
      assert.deepEqual(envs, [{ MY_VAR: 'fallback' }])
    })

    it('expands ${VAR:-default} with set variable', () => {
      const envs = getEnvs(
        'FROM node:24\nENV EXISTING=hello\nENV MY_VAR=${EXISTING:-fallback}'
      )
      assert.deepEqual(envs, [{ EXISTING: 'hello' }, { MY_VAR: 'hello' }])
    })

    it('expands ${VAR:+replacement} with set variable', () => {
      const envs = getEnvs(
        'FROM node:24\nENV EXISTING=hello\nENV MY_VAR=${EXISTING:+replaced}'
      )
      assert.deepEqual(envs, [{ EXISTING: 'hello' }, { MY_VAR: 'replaced' }])
    })

    it('expands ${VAR:+replacement} with unset variable', () => {
      const envs = getEnvs('FROM node:24\nENV MY_VAR=${UNSET_VAR:+replaced}')
      assert.deepEqual(envs, [{ MY_VAR: '' }])
    })

    it('expands undefined variables to empty string', () => {
      const envs = getEnvs('FROM node:24\nENV MY_VAR=prefix${NOPE}suffix')
      assert.deepEqual(envs, [{ MY_VAR: 'prefixsuffix' }])
    })
  })

  describe('single quotes suppress expansion', () => {
    it('does not expand variables inside single-quoted values', () => {
      const envs = getEnvs(
        "FROM node:24\nENV EXISTING=hello\nENV LITERAL='$EXISTING'"
      )
      assert.deepEqual(envs, [{ EXISTING: 'hello' }, { LITERAL: '$EXISTING' }])
    })

    it('does not expand ${VAR} inside single-quoted values', () => {
      const envs = getEnvs(
        "FROM node:24\nENV EXISTING=hello\nENV LITERAL='${EXISTING}'"
      )
      assert.deepEqual(envs, [
        { EXISTING: 'hello' },
        { LITERAL: '${EXISTING}' },
      ])
    })
  })

  describe('multi-pair ENV expansion order', () => {
    it('resolves all pairs against pre-instruction context', () => {
      // Docker resolves all substitutions in a single ENV instruction
      // against the state BEFORE that instruction. So B=$A should see
      // the old value of A, not the new one set in the same line.
      const envs = getEnvs('FROM node:24\nENV A=old\nENV A=new B=$A')
      assert.deepEqual(envs, [{ A: 'old' }, { A: 'new', B: 'old' }])
    })

    it('later ENV instruction sees updated values', () => {
      const envs = getEnvs('FROM node:24\nENV A=old\nENV A=new B=$A\nENV C=$A')
      assert.deepEqual(envs, [
        { A: 'old' },
        { A: 'new', B: 'old' },
        { C: 'new' },
      ])
    })
  })

  describe('combined quote + expansion', () => {
    it('strips quotes then expands variables', () => {
      const envs = getEnvs(
        'FROM node:24\nENV GOPATH="/go"\nENV PATH="/usr/local/go/bin:${GOPATH}/bin"'
      )
      assert.deepEqual(envs, [
        { GOPATH: '/go' },
        { PATH: '/usr/local/go/bin:/go/bin' },
      ])
    })
  })

  describe('ARG handling', () => {
    it('ARG values are available for expansion in ENV', () => {
      const envs = getEnvs('FROM node:24\nARG MY_ARG=hello\nENV MY_ENV=$MY_ARG')
      assert.deepEqual(envs, [{ MY_ARG: 'hello' }, { MY_ENV: 'hello' }])
    })

    it('ARG without default sets empty value', () => {
      const envs = getEnvs('FROM node:24\nARG MY_ARG')
      assert.deepEqual(envs, [{ MY_ARG: '' }])
    })
  })
})
