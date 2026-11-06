import { Command, InvalidArgumentError } from '@commander-js/extra-typings'
import { describe, expect, test } from 'vitest'

import { parseMetadata } from '../src/commands/sandbox/utils'
import { Format, parseFormat, parseMemoryMb } from '../src/options'
import { templateNameSchema } from '../src/utils/templateName'
import { integer, keyValuePairs, zodParser } from '../src/validation'

describe('zodParser', () => {
  test('reports a failed parse as InvalidArgumentError with the issue message', () => {
    const parse = zodParser(integer('Limit', { min: 0 }))
    expect(() => parse('abc')).toThrow(InvalidArgumentError)
    expect(() => parse('abc')).toThrow('Limit must be a non-negative integer.')
  })

  test('commander prints the message after the rejected value', () => {
    const errors: string[] = []
    const command = new Command()
      .exitOverride()
      .configureOutput({ writeErr: (str) => errors.push(str) })
      .option(
        '--limit <limit>',
        'limit',
        zodParser(integer('Limit', { min: 0 }))
      )

    expect(() => command.parse(['--limit', '-1'], { from: 'user' })).toThrow()
    expect(errors.join('')).toContain(
      "option '--limit <limit>' argument '-1' is invalid. Limit must be a non-negative integer."
    )
  })
})

describe('integer', () => {
  test.each([
    ['0', 0],
    [' 42 ', 42],
  ])('parses %j', (value: string, expected: number) => {
    expect(integer('Value', { min: 0 }).parse(value)).toBe(expected)
  })

  test('enforces min and max', () => {
    const count = integer('--count', { min: 1, max: 20 })
    expect(count.safeParse('0').success).toBe(false)
    expect(count.safeParse('21').success).toBe(false)
    expect(count.safeParse('20').data).toBe(20)
    expect(count.safeParse('21').error?.issues[0].message).toBe(
      '--count must be an integer between 1 and 20.'
    )
  })
})

describe('parseMemoryMb', () => {
  test('accepts even values and rejects odd ones', () => {
    expect(parseMemoryMb('2048')).toBe(2048)
    expect(() => parseMemoryMb('1023')).toThrow(
      'Memory in megabytes must be an even number.'
    )
  })
})

describe('parseFormat', () => {
  test('is case-insensitive', () => {
    expect(parseFormat('JSON')).toBe(Format.JSON)
    expect(parseFormat('pretty')).toBe(Format.PRETTY)
  })

  test('rejects unknown formats', () => {
    expect(() => parseFormat('yaml')).toThrow(
      'Format must be one of: json, pretty.'
    )
  })
})

describe('keyValuePairs', () => {
  test('parses comma-separated pairs, splitting on the first =', () => {
    expect(keyValuePairs.parse('env=prod, team = ml,url=a=b')).toEqual({
      env: 'prod',
      team: 'ml',
      url: 'a=b',
    })
  })

  test.each(['key', '=value', 'a=1,', ''])('rejects %j', (value: string) => {
    expect(() => parseMetadata(value)).toThrow(InvalidArgumentError)
  })
})

describe('templateNameSchema', () => {
  test('normalizes to the server form', () => {
    expect(templateNameSchema.parse('  My-Template_1 ')).toBe('my-template_1')
  })

  test.each([
    ['', 'Template name cannot be empty.'],
    ['has space', 'Template name must contain only letters'],
    ['a'.repeat(129), 'Template name must be at most 128 characters long.'],
  ])('rejects %j', (value: string, message: string) => {
    expect(
      templateNameSchema.safeParse(value).error?.issues[0].message
    ).toContain(message)
  })
})
