import { randomUUID } from 'node:crypto'
import { expect, test } from 'vitest'
import { Template } from '../../src'

test('check if base template name exists', async () => {
  const exists = await Template.exists('base')
  expect(exists).toBe(true)
})

test('check non existing name', async () => {
  const nonExistingName = `nonexistent-${randomUUID()}`
  const exists = await Template.exists(nonExistingName)
  expect(exists).toBe(false)
})
