// Global Rate Limit Manager - Coordinates all API requests to prevent 429 errors

class RateLimitManager {
  constructor() {
    this.isInCooldown = false;
    this.cooldownUntil = 0;
    this.backoffDelay = 2000; // Start with 2 seconds
    this.maxBackoff = 60000; // Max 60 seconds
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.consecutive429s = 0;
  }

  // Check if we should allow a request
  canMakeRequest() {
    if (this.isInCooldown) {
      const now = Date.now();
      if (now < this.cooldownUntil) {
        return false;
      }
      // Cooldown expired
      this.isInCooldown = false;
    }
    return true;
  }

  // Handle 429 error - enter cooldown and calculate backoff
  handle429Error() {
    this.consecutive429s++;
    this.isInCooldown = true;
    
    // Exponential backoff: 2s, 4s, 8s, 16s, 32s, 60s (max)
    this.backoffDelay = Math.min(
      Math.pow(2, this.consecutive429s) * 2000,
      this.maxBackoff
    );
    
    this.cooldownUntil = Date.now() + this.backoffDelay;
    
    console.warn(`⚠️ Rate limit hit (429). Cooldown for ${this.backoffDelay / 1000}s. Consecutive: ${this.consecutive429s}`);
    
    return this.backoffDelay;
  }

  // Reset on successful request
  handleSuccess() {
    if (this.consecutive429s > 0) {
      console.log(`✅ Request successful. Resetting rate limit backoff.`);
      this.consecutive429s = 0;
      this.backoffDelay = 2000;
    }
    this.isInCooldown = false;
  }

  // Get time until cooldown ends
  getTimeUntilCooldownEnds() {
    if (!this.isInCooldown) return 0;
    const remaining = this.cooldownUntil - Date.now();
    return Math.max(0, remaining);
  }

  // Queue a request to be executed after cooldown
  queueRequest(requestFn) {
    this.requestQueue.push(requestFn);
    this.processQueue();
  }

  // Process queued requests
  async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      if (!this.canMakeRequest()) {
        const waitTime = this.getTimeUntilCooldownEnds();
        console.log(`⏳ Waiting ${waitTime / 1000}s before processing queue...`);
        await new Promise(resolve => setTimeout(resolve, waitTime + 100));
        continue;
      }

      const requestFn = this.requestQueue.shift();
      try {
        await requestFn();
        this.handleSuccess();
        // Small delay between queued requests
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        if (error.response?.status === 429) {
          this.handle429Error();
          // Re-queue this request
          this.requestQueue.unshift(requestFn);
          // Wait for cooldown
          const waitTime = this.getTimeUntilCooldownEnds();
          await new Promise(resolve => setTimeout(resolve, waitTime + 100));
        } else {
          // Non-429 error, don't re-queue
          this.handleSuccess();
        }
      }
    }

    this.isProcessingQueue = false;
  }

  // Clear queue
  clearQueue() {
    this.requestQueue = [];
  }
}

// Export singleton instance
const rateLimitManager = new RateLimitManager();
export default rateLimitManager;

