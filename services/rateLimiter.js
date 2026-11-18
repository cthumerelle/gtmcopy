import { currentEmitter } from './copyJobs.js';

/**
 * GTM API request queue
 * Sends requests without anticipating quotas and pauses every request when GTM answers with a quota error
 */

class GTMRateLimiter {
  constructor() {
    this.maxConcurrentRequests = 4;
    this.slowRequestThresholdMs = 20000;
    this.requestQueue = [];
    this.activeRequests = 0;
    this.pausedUntil = 0;
    this.resumeTimer = null;
  }

  /**
   * Add a request to the queue
   * @param {Function} requestFunction - Function that makes the API request
   * @param {string} description - Description for logging
   * @param {{operation?: 'CREATE_VERSION'|'PUBLISH_VERSION', containerId?: string}} [options]
   * @returns {Promise} - Promise that resolves with the request result
   */
  async enqueue(requestFunction, description = 'GTM API Request', options = {}) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({
        requestFunction,
        description,
        resolve,
        reject,
        retryCount: 0,
        operation: options.operation || null,
        containerId: options.containerId || null,
        timestamp: Date.now(),
        emit: currentEmitter()
      });

      this.processQueue();
    });
  }

  processQueue() {
    const pauseRemaining = this.pausedUntil - Date.now();
    if (pauseRemaining > 0) {
      if (!this.resumeTimer) {
        this.resumeTimer = setTimeout(() => {
          this.resumeTimer = null;
          this.processQueue();
        }, pauseRemaining);
      }
      return;
    }

    while (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const request = this.requestQueue.shift();
      this.activeRequests++;
      this.executeRequest(request).finally(() => {
        this.activeRequests--;
        this.processQueue();
      });
    }
  }

  /**
   * Execute a request with error handling and retry logic
   * @param {Object} request - Request object from queue
   */
  async executeRequest(request) {
    console.log(`🚀 Executing GTM API request: ${request.description}`);
    const startedAt = Date.now();
    
    try {
      const result = await request.requestFunction();
      
      // Log successful response
      console.log(`✅ API Success: ${request.description} ⏱ ${Date.now() - startedAt}ms`);
      console.log(`📊 Response status: ${result?.status || 'unknown'}`);
      if (result?.config?.url) {
        console.log(`🌐 URL: ${result.config.method?.toUpperCase()} ${result.config.url}`);
      }
      // Log response data with filtered templateData to avoid log explosion
      const filteredData = this.filterResponseData(result.data);
      console.log(`📋 Response data:`, JSON.stringify(filteredData, null, 2));
      
      request.resolve(result);
      
    } catch (error) {
      // Log detailed error information
      const durationMs = Date.now() - startedAt;
      console.log(`❌ API Error: ${request.description} ⏱ ${durationMs}ms`);
      if (error.config?.url) {
        console.log(`🌐 URL: ${error.config.method?.toUpperCase()} ${error.config.url}`);
      }
      // Log response if available
      if (error.response) {
        console.log(`📋 Response:`, JSON.stringify(error.response, null, 2));
      }
      console.log(`💬 Error Message: ${error.message}`);
      
      await this.handleRequestError(request, error, durationMs);
    }
  }

  /**
   * Handle request errors with retry logic
   * @param {Object} request - Request object
   * @param {Error} error - The error that occurred
   * @param {number} durationMs - Time the failed attempt took
   */
  async handleRequestError(request, error, durationMs = 0) {
    const isRecoverable = this.isRecoverableError(error);
    const isQuotaError = this.isQuotaError(error);
    
    // For quota errors, limit to 10 attempts to avoid infinite loops. For others, limit to 5 attempts
    const maxRetries = isQuotaError ? 10 : 5;
    const hasRetriesLeft = request.retryCount < maxRetries;
    const shouldRetry = isRecoverable && hasRetriesLeft;

    if (shouldRetry) {
      request.retryCount++;
      const delay = this.getRetryDelay(); // Uniform delay for all retries

      console.log(`Request failed (${request.description}). Retrying in ${delay}ms... (Attempt ${request.retryCount})`);
      console.log(`Error: ${error.message}`);
      request.emit('RETRY_SCHEDULED', {
        request: request.description,
        attempt: request.retryCount,
        maxRetries,
        httpStatus: error.response?.status || null,
        reason: this.getRetryReason(request, error, durationMs),
        operation: request.operation,
        containerId: request.containerId,
        durationMs,
        waitMs: delay,
        resumeAt: Date.now() + delay
      });

      if (isQuotaError) {
        this.pausedUntil = Math.max(this.pausedUntil, Date.now() + delay);
        console.log(`GTM quota exceeded, pausing all requests for ${delay}ms.`);
        this.requestQueue.unshift(request);
      } else {
        setTimeout(() => {
          this.requestQueue.unshift(request);
          this.processQueue();
        }, delay);
      }
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
   * @param {Object} request
   * @param {Error} error
   * @param {number} durationMs
   * @returns {'QUOTA'|'STILL_PROCESSING'|'SERVER_ERROR'}
   */
  getRetryReason(request, error, durationMs) {
    if (this.isQuotaError(error)) return 'QUOTA';
    const isGatewayTimeout = [503, 504].includes(error.response?.status);
    if (request.operation && isGatewayTimeout && durationMs >= this.slowRequestThresholdMs) {
      return 'STILL_PROCESSING';
    }
    return 'SERVER_ERROR';
  }

  /**
   * Check if error is related to quota/rate limiting
   * Based on official Google API error structure, distinguishing real quota from business errors
   * @param {Error} error - The error to check
   * @returns {boolean}
   */
  isQuotaError(error) {
    const status = error.response?.status;
    const errorData = error.response?.data?.error || {};
    
    // 1. Any 429 Too Many Requests is a rate limit
    if (status === 429) return true;
    
    // 2. Google APIs sometimes return 403 for quota/rate limits
    if (status === 403) {
      const message = (errorData.message || '').toLowerCase();
      if (message.includes('quota') || message.includes('rate limit')) {
        return true;
      }
      
      const errors = errorData.errors || [];
      const isRateLimitReason = errors.some(err => 
        err.reason === 'rateLimitExceeded' || 
        err.reason === 'userRateLimitExceeded' ||
        err.reason === 'dailyLimitExceeded'
      );
      if (isRateLimitReason) return true;
    }
    
    // 3. Keep existing strict check for other cases
    const details = errorData.details || [];
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
    return 10000;
  }

  /**
   * Filter response data to avoid logging huge template data
   * @param {Object} data - Response data to filter
   * @returns {Object} - Filtered data
   */
  filterResponseData(data) {
    if (!data || typeof data !== 'object') return data;
    return JSON.parse(JSON.stringify(data, (key, value) =>
      key === 'templateData' && value ? '[TEMPLATE_DATA_HIDDEN]' : value
    ));
  }

  /**
   * Get current queue status
   * @returns {{queueLength: number, activeRequests: number, pausedForMs: number}}
   */
  getStatus() {
    return {
      queueLength: this.requestQueue.length,
      activeRequests: this.activeRequests,
      pausedForMs: Math.max(0, this.pausedUntil - Date.now())
    };
  }
}

// Create singleton instance
const rateLimiter = new GTMRateLimiter();

export default rateLimiter;
export { GTMRateLimiter };