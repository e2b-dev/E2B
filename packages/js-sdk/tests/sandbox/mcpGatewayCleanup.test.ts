/**
 * Tests for MCP gateway startup failure cleanup.
 *
 * When the MCP gateway fails to start (non-zero exit code or exception),
 * the sandbox should be killed to prevent orphaned resources.
 */
import { afterEach, assert, describe, expect, test, vi } from 'vitest'

import { Sandbox } from '../../src'
import { SandboxApi } from '../../src/sandbox/sandboxApi'
import { Commands } from '../../src/sandbox/commands'
import { TEST_API_KEY } from '../setup'

const baseConfig = {
    apiKey: TEST_API_KEY,
    domain: 'base.e2b.dev',
}

const fakeSandboxInfo = {
    sandboxId: 'sbx-test',
    sandboxDomain: 'sandbox.e2b.dev',
    envdVersion: '0.2.4',
    envdAccessToken: 'tok',
    trafficAccessToken: 'tok',
}

function mockCreateSandbox() {
    vi.spyOn(SandboxApi as any, 'createSandbox').mockResolvedValue(fakeSandboxInfo)
}

describe('MCP gateway cleanup on failure', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    test('successful MCP gateway startup does not kill sandbox', async () => {
        mockCreateSandbox()

        vi.spyOn(Commands.prototype, 'run').mockResolvedValue({
            exitCode: 0,
            stdout: '',
            stderr: '',
        })

        const killSpy = vi
            .spyOn(Sandbox.prototype, 'kill')
            .mockResolvedValue(true)

        const result = await Sandbox.create('mcp-gateway', {
            mcp: { exa: {} } as any,
            ...baseConfig,
        })

        assert.isDefined(result)
        assert.equal(killSpy.mock.calls.length, 0)
    })

    test('MCP gateway non-zero exit code kills sandbox', async () => {
        mockCreateSandbox()

        vi.spyOn(Commands.prototype, 'run').mockResolvedValue({
            exitCode: 1,
            stdout: '',
            stderr: 'gateway error',
        })

        const killSpy = vi
            .spyOn(Sandbox.prototype, 'kill')
            .mockResolvedValue(true)

        await expect(
            Sandbox.create('mcp-gateway', {
                mcp: { exa: {} } as any,
                ...baseConfig,
            })
        ).rejects.toThrow(/Failed to start MCP gateway/)

        assert.equal(killSpy.mock.calls.length, 1)
    })

    test('MCP gateway exception kills sandbox', async () => {
        mockCreateSandbox()

        vi.spyOn(Commands.prototype, 'run').mockRejectedValue(
            new Error('connection lost')
        )

        const killSpy = vi
            .spyOn(Sandbox.prototype, 'kill')
            .mockResolvedValue(true)

        await expect(
            Sandbox.create('mcp-gateway', {
                mcp: { exa: {} } as any,
                ...baseConfig,
            })
        ).rejects.toThrow(/connection lost/)

        assert.equal(killSpy.mock.calls.length, 1)
    })

    test('original error propagated even when kill fails', async () => {
        mockCreateSandbox()

        vi.spyOn(Commands.prototype, 'run').mockResolvedValue({
            exitCode: 1,
            stdout: '',
            stderr: 'startup failed',
        })

        const killSpy = vi
            .spyOn(Sandbox.prototype, 'kill')
            .mockRejectedValue(new Error('kill also failed'))

        await expect(
            Sandbox.create('mcp-gateway', {
                mcp: { exa: {} } as any,
                ...baseConfig,
            })
        ).rejects.toThrow(/Failed to start MCP gateway/)

        // kill was attempted even though it failed
        assert.equal(killSpy.mock.calls.length, 1)
    })

    test('kill failure is suppressed (best-effort cleanup)', async () => {
        mockCreateSandbox()

        vi.spyOn(Commands.prototype, 'run').mockRejectedValue(
            new Error('run failed')
        )

        vi.spyOn(Sandbox.prototype, 'kill').mockRejectedValue(
            new Error('kill failed too')
        )

        // Should throw the original error, not the kill error
        await expect(
            Sandbox.create('mcp-gateway', {
                mcp: { exa: {} } as any,
                ...baseConfig,
            })
        ).rejects.toThrow(/run failed/)
    })

    test('no MCP config means no gateway startup or kill', async () => {
        mockCreateSandbox()

        const runSpy = vi
            .spyOn(Commands.prototype, 'run')
            .mockResolvedValue({
                exitCode: 0,
                stdout: '',
                stderr: '',
            })

        const killSpy = vi
            .spyOn(Sandbox.prototype, 'kill')
            .mockResolvedValue(true)

        const sandbox = await Sandbox.create('base', baseConfig)

        assert.isDefined(sandbox)
        assert.equal(runSpy.mock.calls.length, 0)
        assert.equal(killSpy.mock.calls.length, 0)
    })

    test('MCP token is set on sandbox when MCP is configured', async () => {
        mockCreateSandbox()

        vi.spyOn(Commands.prototype, 'run').mockResolvedValue({
            exitCode: 0,
            stdout: '',
            stderr: '',
        })

        vi.spyOn(Sandbox.prototype, 'kill').mockResolvedValue(true)

        const sandbox = await Sandbox.create('mcp-gateway', {
            mcp: { exa: {} } as any,
            ...baseConfig,
        })

        assert.isDefined(sandbox.mcpToken)
        assert.isString(sandbox.mcpToken)
    })
})
