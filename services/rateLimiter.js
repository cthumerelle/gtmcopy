/**
 * GTM API Rate Limiter
 * Handles Google Tag Manager API rate limiting (15 requests/minute, 0.25 QPS)
 */

class GTMRateLimiter {
  constructor() {
    // GTM API limits: 15 requests per minute (0.25 QPS)
    this.maxRequestsPerMinute = 15;
    this.maxRequestsPer100Seconds = 25; // Sliding window
    this.requestQueue = [];
    this.requestHistory = []; // Track request timestamps
    this.isProcessing = false;
    // No retry limits for quota errors - uniform delay for all retries
  }

  /**
   * Add a request to the queue
   * @param {Function} requestFunction - Function that makes the API request
   * @param {string} description - Description for logging
   * @returns {Promise} - Promise that resolves with the request result
   */
  async enqueue(requestFunction, description = 'GTM API Request') {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        requestFunction,
        description,
        resolve,
        reject,
        retryCount: 0,
        timestamp: Date.now()
      });

      this.processQueue();
    });
  }

  /**
   * Process the request queue with rate limiting
   */
  async processQueue() {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.requestQueue.length > 0) {
      const now = Date.now();
      
      // Clean up old request history (older than 100 seconds)
      this.requestHistory = this.requestHistory.filter(
        timestamp => now - timestamp < 100000
      );

      // Check if we can make a request
      if (this.canMakeRequest()) {
        const request = this.requestQueue.shift();
        await this.executeRequest(request);
      } else {
        // Wait before checking again
        const waitTime = this.getWaitTime();
        console.log(`Rate limit reached. Waiting ${waitTime}ms before next request...`);
        await this.sleep(waitTime);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Check if we can make a request without exceeding rate limits
   * @returns {boolean}
   */
  canMakeRequest() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const hundredSecondsAgo = now - 100000;

    // Count requests in the last minute
    const requestsInLastMinute = this.requestHistory.filter(
      timestamp => timestamp > oneMinuteAgo
    ).length;

    // Count requests in the last 100 seconds
    const requestsInLast100Seconds = this.requestHistory.filter(
      timestamp => timestamp > hundredSecondsAgo
    ).length;

    return requestsInLastMinute < this.maxRequestsPerMinute && 
           requestsInLast100Seconds < this.maxRequestsPer100Seconds;
  }

  /**
   * Calculate wait time before next request
   * @returns {number} - Wait time in milliseconds
   */
  getWaitTime() {
    const now = Date.now();
    const oldestRelevantRequest = this.requestHistory.find(
      timestamp => now - timestamp < 100000
    );

    if (!oldestRelevantRequest) {
      const baseDelay = 1000; // Default 1 second
      const jitter = Math.random() * 500; // 0-0.5s jitter
      return baseDelay + jitter;
    }

    // Wait until we can make the next request
    const timeSinceOldest = now - oldestRelevantRequest;
    const baseTimeToWait = Math.max(1000, 100000 - timeSinceOldest + 1000);
    const cappedTime = Math.min(baseTimeToWait, 10000); // Cap at 10 seconds
    
    // Add jitter to avoid thundering herd
    const jitter = Math.random() * 2000; // 0-2s jitter
    return cappedTime + jitter;
  }

  /**
   * Execute a request with error handling and retry logic
   * @param {Object} request - Request object from queue
   */
  async executeRequest(request) {
    console.log(`🚀 Executing GTM API request: ${request.description}`);
    
    try {
      const result = await request.requestFunction();
      
      // Log successful response
      console.log(`✅ API Success: ${request.description}`);
      console.log(`📊 Response status: ${result?.status || 'unknown'}`);
      if (result?.config?.url) {
        console.log(`🌐 URL: ${result.config.method?.toUpperCase()} ${result.config.url}`);
      }
      // Log response data with filtered templateData to avoid log explosion
      const filteredData = this.filterResponseData(result.data);
      console.log(`📋 Response data:`, JSON.stringify(filteredData, null, 2));
      
      // Record successful request
      this.requestHistory.push(Date.now());
      request.resolve(result);
      
    } catch (error) {
      // Log detailed error information
      console.log(`❌ API Error: ${request.description}`);
      if (error.config?.url) {
        console.log(`🌐 URL: ${error.config.method?.toUpperCase()} ${error.config.url}`);
      }
      // Log response if available
      if (error.response) {
        console.log(`📋 Response:`, JSON.stringify(error.response, null, 2));
      }
      console.log(`💬 Error Message: ${error.message}`);
      
      await this.handleRequestError(request, error);
    }
  }

  /**
   * Handle request errors with retry logic
   * @param {Object} request - Request object
   * @param {Error} error - The error that occurred
   */
  async handleRequestError(request, error) {
    const isRecoverable = this.isRecoverableError(error);
    const isQuotaError = this.isQuotaError(error);
    
    // For quota errors, retry indefinitely. For others, limit to 5 attempts
    const maxRetries = isQuotaError ? Infinity : 5;
    const hasRetriesLeft = request.retryCount < maxRetries;
    const shouldRetry = isRecoverable && hasRetriesLeft;

    if (shouldRetry) {
      request.retryCount++;
      const delay = this.getRetryDelay(); // Uniform delay for all retries

      console.log(`Request failed (${request.description}). Retrying in ${delay}ms... (Attempt ${request.retryCount})`);
      console.log(`Error: ${error.message}`);

      await this.sleep(delay);
      
      // Re-queue the request
      this.requestQueue.unshift(request);
    } else {
      // Log different messages for different failure types
      if (!isRecoverable) {
        // Extract the actual API error message
        const apiError = error.response?.data?.error?.message || 
                        error.response?.statusText || 
                        error.message;
        
        console.warn(`Request failed with non-recoverable error (${request.description}):`);
        console.warn(`API Error: ${apiError}`);
        console.warn(`HTTP Status: ${error.response?.status || 'unknown'}`);
        console.warn(`Continuing with next operation.`);
      } else {
        console.error(`Request failed permanently after ${request.retryCount} retries (${request.description}):`, error);
      }
      request.reject(error);
    }
  }

  /**
   * Check if error is related to quota/rate limiting
   * Based on official Google API error structure, distinguishing real quota from business errors
   * @param {Error} error - The error to check
   * @returns {boolean}
   */
  isQuotaError(error) {
    // Must have status 429 to be a quota error
    if (error.response?.status !== 429) return false;
    
    // Check for quota-specific metadata (most reliable)
    const errorData = error.response?.data?.error || {};
    const details = errorData.details || [];
    
    // True quota errors have quota metadata
    return details.some(detail =>
      detail.metadata?.quota_limit || detail.metadata?.quota_metric
    );
  }

  /**
   * Check if error is recoverable (should be retried)
   * Simplified approach: only retry quota and server errors
   * @param {Error} error - The error to check
   * @returns {boolean}
   */
  isRecoverableError(error) {
    // 1. Quota/rate limit errors → RETRY
    if (this.isQuotaError(error)) {
      return true;
    }
    
    // 2. Server errors (5xx) → RETRY
    const status = error.response?.status;
    if (status >= 500) {
      return true;
    }
    
    // EVERYTHING ELSE → NO RETRY
    // This includes workspace limits, permissions, validation errors, etc.
    return false;
  }

  /**
   * Get retry delay - uniform for all error types
   * @returns {number} - Delay in milliseconds
   */
  getRetryDelay() {
    // Uniform delay for all retry types
    const baseDelay = 10000; // 10 seconds
    const jitter = Math.random() * 5000; // Add up to 5s jitter to avoid thundering herd
    return baseDelay + jitter;
  }

  /**
   * Filter response data to avoid logging huge template data
   * @param {Object} data - Response data to filter
   * @returns {Object} - Filtered data
   */
  filterResponseData(data) {
    if (!data || typeof data !== 'object') return data;
    
    // Create a deep copy to avoid modifying original data
    const filtered = JSON.parse(JSON.stringify(data));
    
    // Filter templates array
    if (filtered.template && Array.isArray(filtered.template)) {
      filtered.template = filtered.template.map(template => ({
        ...template,
        templateData: template.templateData ? '[TEMPLATE_DATA_HIDDEN]' : undefined
      }));
    }
    
    // Filter single template object
    if (filtered.templateData) {
      filtered.templateData = '[TEMPLATE_DATA_HIDDEN]';
    }
    
    return filtered;
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current queue status
   * @returns {Object} - Status information
   */
  getStatus() {
    const now = Date.now();
    const recentRequests = this.requestHistory.filter(
      timestamp => now - timestamp < 60000
    ).length;

    return {
      queueLength: this.requestQueue.length,
      requestsInLastMinute: recentRequests,
      requestsInLast100Seconds: this.requestHistory.filter(
        timestamp => now - timestamp < 100000
      ).length,
      isProcessing: this.isProcessing,
      canMakeRequest: this.canMakeRequest(),
      estimatedWaitTime: this.canMakeRequest() ? 0 : this.getWaitTime()
    };
  }

  /**
   * Estimate total time for a given number of requests
   * @param {number} requestCount - Number of requests
   * @returns {number} - Estimated time in milliseconds
   */
  estimateTime(requestCount) {
    if (requestCount <= this.maxRequestsPerMinute) {
      return requestCount * 4000; // 4 seconds per request (safe margin)
    }

    // For larger batches, calculate based on rate limits
    const minutes = Math.ceil(requestCount / this.maxRequestsPerMinute);
    return minutes * 60000; // Convert to milliseconds
  }
}

// Create singleton instance
const rateLimiter = new GTMRateLimiter();

export default rateLimiter;
export { GTMRateLimiter };