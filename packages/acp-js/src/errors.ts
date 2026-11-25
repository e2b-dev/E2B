/**
 * Thrown when the agent breaks the connection: it sends a message over
 * `maxMessageBytes` or exits with a non-zero code.
 */
export class ACPError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ACPError'
  }
}
