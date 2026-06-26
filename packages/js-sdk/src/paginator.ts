import type { ConnectionOpts } from './connectionConfig'

/**
 * Generic, reusable paginator for cursor-based list endpoints.
 *
 * The base owns the shared pagination state — `hasNext`, `nextToken`, and the
 * reading of the `x-next-token` response header (via {@link Paginator.updatePagination}).
 * Each concrete paginator implements {@link Paginator.nextItems} to do the
 * actual fetching for its endpoint, so any model can expose pagination by
 * subclassing this without reimplementing the bookkeeping.
 *
 * The optional `O` type parameter is the per-call options type accepted by
 * `nextItems` (e.g. connection options for a given API).
 *
 * @example
 * ```ts
 * const paginator = Sandbox.list()
 * while (paginator.hasNext) {
 *   const items = await paginator.nextItems()
 *   console.log(items)
 * }
 * ```
 */
export abstract class Paginator<T, O extends ConnectionOpts = ConnectionOpts> {
  protected readonly opts?: O
  protected readonly limit?: number

  private _hasNext: boolean
  private _nextToken?: string

  constructor(opts?: O, limit?: number, nextToken?: string) {
    this.opts = opts
    this.limit = limit

    this._hasNext = true
    this._nextToken = nextToken
  }

  /**
   * Returns true if there are more items to fetch.
   */
  get hasNext(): boolean {
    return this._hasNext
  }

  /**
   * Returns the next token to use for pagination.
   */
  get nextToken(): string | undefined {
    return this._nextToken
  }

  /**
   * Update the pagination state from a response, reading the `x-next-token`
   * header. Concrete paginators call this from {@link Paginator.nextItems}
   * after fetching a page.
   */
  protected updatePagination(response: Response) {
    this._nextToken = response.headers.get('x-next-token') || undefined
    this._hasNext = !!this._nextToken
  }

  /**
   * Get the next page of items.
   *
   * @param opts per-call connection options. When provided, this call uses
   * these options (e.g. `apiKey`, `domain`, `headers`, `requestTimeoutMs`,
   * `signal`) instead of the ones the paginator was constructed with.
   * Aborting a page via `signal` does not affect subsequent {@link Paginator.nextItems}
   * calls — pass a fresh signal each call you want to be cancellable.
   *
   * @throws Error if there are no more items to fetch. Call this method only if `hasNext` is `true`.
   *
   * @returns List of items
   */
  abstract nextItems(opts?: O): Promise<T[]>
}
