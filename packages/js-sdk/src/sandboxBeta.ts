// Do not add new functionality to the SandboxBeta.

import { compareVersions } from 'compare-versions'

import { Sandbox, SandboxOpts } from './sandbox'
import { SandboxApiOpts } from './sandbox/sandboxApi'
import { ConnectionConfig } from './connectionConfig'
import { ApiClient, handleApiError } from './api'
import { NotFoundError } from './errors'

import type { components } from './api'

// TODO: Add description
export class SandboxBeta extends Sandbox {
  /**
   * Resume the sandbox.
   *
   * The **default sandbox timeout of 300 seconds** ({@link Sandbox.defaultSandboxTimeoutMs}) will be used for the resumed sandbox.
   * If you pass a custom timeout in the `opts` parameter via {@link SandboxOpts.timeoutMs} property, it will be used instead.
   *
   * @param sandboxId sandbox ID.
   * @param opts connection options.
   *
   * @returns a running sandbox instance.
   */
  static async resume<S extends typeof Sandbox>(
    this: S,
    sandboxId: string,
    opts?: Omit<SandboxOpts, 'metadata' | 'envs'>
  ): Promise<InstanceType<S>> {
    await SandboxBeta.resumeSandbox(
      sandboxId,
      opts?.timeoutMs ?? this.defaultSandboxTimeoutMs,
      opts
    )

    return await this.connect(sandboxId, opts)
  }

  /**
   * Pause a sandbox by its ID.
   *
   * @param sandboxId sandbox ID.
   * @param opts connection options.
   *
   * @returns sandbox ID that can be used to resume the sandbox.
   */
  static async pause(
    sandboxId: string,
    opts?: Omit<SandboxOpts, 'metadata' | 'envs' | 'timeoutMs'>
  ): Promise<string> {
    await SandboxBeta.pauseSandbox(sandboxId, opts)
    return sandboxId
  }

  /**
   * Get the metrics of the sandbox.
   *
   * @param sandboxId sandbox ID.
   * @param opts connection options.
   *
   * @returns metrics of the sandbox.
   */
  static async getMetrics(
    sandboxId: string,
    opts?: SandboxApiOpts
  ): Promise<components['schemas']['SandboxMetric'][]> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.GET('/sandboxes/{sandboxID}/metrics', {
      params: {
        path: {
          sandboxID: sandboxId,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    return (
      res.data?.map((metric: components['schemas']['SandboxMetric']) => ({
        ...metric,
        timestamp: new Date(metric.timestamp).toISOString(),
      })) ?? []
    )
  }

  /**
   * Pause the sandbox specified by sandbox ID.
   *
   * @param sandboxId sandbox ID.
   * @param opts connection options.
   *
   * @returns `true` if the sandbox got paused, `false` if the sandbox was already paused.
   */
  protected static async pauseSandbox(
    sandboxId: string,
    opts?: SandboxApiOpts
  ): Promise<boolean> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/sandboxes/{sandboxID}/pause', {
      params: {
        path: {
          sandboxID: sandboxId,
        },
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    if (res.error?.code === 404) {
      throw new NotFoundError(`Sandbox ${sandboxId} not found`)
    }

    if (res.error?.code === 409) {
      // Sandbox is already paused
      return false
    }

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    return true
  }

  protected static async resumeSandbox(
    sandboxId: string,
    timeoutMs: number,
    opts?: SandboxApiOpts
  ): Promise<boolean> {
    const config = new ConnectionConfig(opts)
    const client = new ApiClient(config)

    const res = await client.api.POST('/sandboxes/{sandboxID}/resume', {
      params: {
        path: {
          sandboxID: sandboxId,
        },
      },
      body: {
        autoPause: false,
        timeout: this.timeoutToSeconds(timeoutMs),
      },
      signal: config.getSignal(opts?.requestTimeoutMs),
    })

    if (res.error?.code === 404) {
      throw new NotFoundError(`Paused sandbox ${sandboxId} not found`)
    }

    if (res.error?.code === 409) {
      // Sandbox is already running
      return false
    }

    const err = handleApiError(res)
    if (err) {
      throw err
    }

    return true
  }

  /**
   * Get the metrics of the sandbox.
   *
   * @param timeoutMs timeout in **milliseconds**.
   * @param opts connection options.
   *
   * @returns metrics of the sandbox.
   */
  async getMetrics(
    opts?: Pick<SandboxOpts, 'requestTimeoutMs'>
  ): Promise<components['schemas']['SandboxMetric'][]> {
    if (
      this.envdApi.version &&
      compareVersions(this.envdApi.version, '0.1.5') < 0
    ) {
      throw new Error(
        'Metrics are not supported in this version of the sandbox, please rebuild your template.'
      )
    }
    return await SandboxBeta.getMetrics(this.sandboxId, {
      ...this.connectionConfig,
      ...opts,
    })
  }

  /**
   * Pause the sandbox.
   *
   * @param opts connection options.
   *
   * @returns sandbox ID that can be used to resume the sandbox.
   */
  async pause(opts?: Pick<SandboxOpts, 'requestTimeoutMs'>): Promise<string> {
    await SandboxBeta.pauseSandbox(this.sandboxId, {
      ...this.connectionConfig,
      ...opts,
    })

    return this.sandboxId
  }
}
