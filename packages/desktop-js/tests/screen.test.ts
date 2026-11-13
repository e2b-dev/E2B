import { expect } from 'vitest'
import { sandboxTest } from './setup'

sandboxTest('get screen size', async ({ sandbox }) => {
  const size = await sandbox.getScreenSize()
  expect(size).toEqual({ width: 1024, height: 768 })
})

sandboxTest('take screenshot', async ({ sandbox }) => {
  const screenshot = await sandbox.screenshot()
  expect(screenshot.length).toBeGreaterThan(0)
})
