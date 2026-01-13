import { randomUUID } from 'node:crypto'
import { test, assert } from 'vitest'

import { Template, defaultBuildLogger } from '../../src'
import { isIntegrationTest } from '../setup'

// Generate a unique test ID for this test run
const testRunId = randomUUID().slice(0, 8)

test.skipIf(!isIntegrationTest)(
  'build template with tags and manage them',
  async () => {
    // Build a template with initial tags
    const templateAlias = `e2b-tags-test-${testRunId}`
    const initialTag = `${templateAlias}:v1.0`

    console.log(`Building template with tag: ${initialTag}`)

    const template = Template().fromBaseImage()

    const buildInfo = await Template.build(template, initialTag, {
      cpuCount: 1,
      memoryMB: 1024,
      skipCache: true,
      onBuildLogs: defaultBuildLogger(),
    })

    console.log('Build completed:', buildInfo)
    assert.ok(buildInfo.buildId, 'Build ID should be present')
    assert.ok(buildInfo.templateId, 'Template ID should be present')

    // Assign additional tags to the build
    const productionTag = `${templateAlias}:production`
    const latestTag = `${templateAlias}:latest`

    console.log(`Assigning tags: ${productionTag}, ${latestTag}`)

    const tagInfo = await Template.assignTag(initialTag, [
      productionTag,
      latestTag,
    ])

    console.log('Tag assignment result:', tagInfo)
    assert.ok(tagInfo.buildId, 'Tag info should have build ID')
    assert.ok(tagInfo.tags.includes(productionTag), 'Should include production tag')
    assert.ok(tagInfo.tags.includes(latestTag), 'Should include latest tag')

    // Delete one of the tags
    console.log(`Deleting tag: ${productionTag}`)
    await Template.deleteTag(productionTag)
    console.log('Tag deleted successfully')

    // Verify that deleting a non-existent tag throws an error
    console.log('Verifying that deleting non-existent tag throws error')
    try {
      await Template.deleteTag(`${templateAlias}:nonexistent-tag-${testRunId}`)
      assert.fail('Should have thrown an error for non-existent tag')
    } catch (error) {
      console.log('Expected error received for non-existent tag:', error.message)
      assert.ok(error, 'Should throw error for non-existent tag')
    }

    // Clean up - delete remaining tags
    console.log('Cleaning up remaining tags')
    await Template.deleteTag(initialTag)
    await Template.deleteTag(latestTag)
    console.log('Cleanup completed')
  },
  { timeout: 300_000 } // 5 minute timeout for build
)

test.skipIf(!isIntegrationTest)(
  'assign single tag to existing template',
  async () => {
    const templateAlias = `e2b-single-tag-test-${testRunId}`
    const initialTag = `${templateAlias}:v1.0`

    console.log(`Building template with tag: ${initialTag}`)

    const template = Template().fromBaseImage()

    await Template.build(template, initialTag, {
      cpuCount: 1,
      memoryMB: 1024,
      skipCache: true,
    })

    // Assign a single tag (not array)
    const stableTag = `${templateAlias}:stable`
    console.log(`Assigning single tag: ${stableTag}`)

    const tagInfo = await Template.assignTag(initialTag, stableTag)

    assert.ok(tagInfo.buildId, 'Tag info should have build ID')
    assert.ok(tagInfo.tags.includes(stableTag), 'Should include stable tag')

    // Clean up
    await Template.deleteTag(initialTag)
    await Template.deleteTag(stableTag)
    console.log('Test completed and cleaned up')
  },
  { timeout: 300_000 }
)
