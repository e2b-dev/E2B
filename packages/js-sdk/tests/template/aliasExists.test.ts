import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { Template } from '../../src'

test('check if base template alias exists', async () => {
  const exists = await Template.aliasExists('base')
  expect(exists).toBe(true)
})

test('check non existing alias', async () => {
  const nonExistingAlias = `nonexistent-${randomUUID()}`
  const exists = await Template.aliasExists(nonExistingAlias)
  expect(exists).toBe(false)
})
