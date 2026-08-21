import { randomUUID } from 'node:crypto'
import { expect } from 'vitest'
import { Template } from '../../src'
import { e2eTest } from '../setup'

e2eTest('check if base template name exists', async () => {
  const exists = await Template.exists('base')
  expect(exists).toBe(true)
})

e2eTest('check non existing name', async () => {
  const nonExistingName = `nonexistent-${randomUUID()}`
  const exists = await Template.exists(nonExistingName)
  expect(exists).toBe(false)
})
