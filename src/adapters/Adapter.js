// The contract every platform must satisfy. The core app talks ONLY to this
// shape. Adding a platform = adding one file that implements these two methods.

export class Adapter {
  constructor(platformId) {
    this.platformId = platformId
  }

  /**
   * Publish one post to this platform.
   * @returns {Promise<{ok: boolean, ref?: string, error?: string}>}
   *   ref = the platform's own id for the created post (needed later for metrics)
   */
  async publish(post) {
    throw new Error(`${this.platformId}: publish() not implemented`)
  }

  /**
   * Fetch metrics for a previously published post.
   * @param {string} ref  the value returned by publish()
   */
  async fetchMetrics(ref) {
    throw new Error(`${this.platformId}: fetchMetrics() not implemented`)
  }
}