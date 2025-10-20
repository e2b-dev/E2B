import * as fs from 'fs/promises'
import * as path from 'path'
import { execSync } from 'child_process'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'

describe('Template Delete --config', () => {
    let testDir: string

    beforeEach(async () => {
        testDir = await fs.mkdtemp('e2b-delete-config-test-')

        const defaultConfig = `template_id = "default-template-id"
dockerfile = "e2b.Dockerfile"`
        await fs.writeFile(path.join(testDir, 'e2b.toml'), defaultConfig)

        const customConfig = `template_id = "custom-template-id"
dockerfile = "e2b.Dockerfile"`
        await fs.writeFile(path.join(testDir, 'custom.toml'), customConfig)

        await fs.writeFile(path.join(testDir, 'e2b.Dockerfile'), 'FROM alpine:3.18')
    })

    afterEach(async () => {
        if (testDir) {
            await fs.rm(testDir, { recursive: true, force: true })
        }
    })

    test('uses the config file passed via --config even when e2b.toml exists', async () => {
        const cliPath = path.join(process.cwd(), 'dist', 'index.js')

        let output = ''
        try {
            output = execSync(
                `node "${cliPath}" template delete --yes --path "${testDir}" --config custom.toml 2>&1`,
                { encoding: 'utf-8', stdio: 'pipe', timeout: 10_000 }
            )
        } catch (err: any) {
            output = (err?.stdout ?? '') + (err?.stderr ?? '')
        }

        expect(output).toContain('Sandbox templates to delete')
        expect(output).toContain('custom-template-id')
        expect(output).toContain('custom.toml')
        expect(output).not.toContain('default-template-id')
    })

    test('uses the default e2b.toml when --config is not provided', async () => {
        const cliPath = path.join(process.cwd(), 'dist', 'index.js')

        let output = ''
        try {
            output = execSync(
                `node "${cliPath}" template delete --yes --path "${testDir}" 2>&1`,
                { encoding: 'utf-8', stdio: 'pipe', timeout: 10_000 }
            )
        } catch (err: any) {
            output = (err?.stdout ?? '') + (err?.stderr ?? '')
        }

        expect(output).toContain('Sandbox templates to delete')
        expect(output).toContain('default-template-id')
        expect(output).toContain('e2b.toml')
        expect(output).not.toContain('custom-template-id')
    })
})


