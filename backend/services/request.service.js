const axios = require("axios");
const http = require("http");
const https = require("https");
const { validateUrlForSSRF } = require("../utils/ssrf.util");
const { logger } = require("../utils/logger");

/**
 * SECURE REQUEST SERVICE
 * 
 * A wrapper for axios that enforces SSRF protection on every call.
 */
class RequestService {
  /**
   * Performs a safe axios request.
   * @param {string} url 
   * @param {Object} options Axios configuration options
   */
  async request(url, options = {}) {
    const check = await validateUrlForSSRF(url);
    if (!check.safe) {
      throw new Error(`[SSRF_V1] Access Denied: URL failed security validation. Target: ${url}`);
    }

    // PINNED DNS AGENT:
    // We override lookup to return the exact IP we just validated.
    // This prevents DNS Rebinding attacks where the domain changes IP between check and request.
    const lookupOverride = (hostname, opts, cb) => {
      // Return the pinned IP for the validated hostname
      if (hostname === check.parsedUrl.hostname) {
        return cb(null, check.ip, 4); // Force IPv4 for simplicity in this implementation
      }
      // Fallback for other domains (unlikely in this context)
      require("dns").lookup(hostname, opts, cb);
    };

    const httpAgent = new http.Agent({ lookup: lookupOverride });
    const httpsAgent = new https.Agent({ lookup: lookupOverride });

    // Standard timeouts to prevent hanging connections
    const config = {
      timeout: options.timeout || 10000,
      maxRedirects: options.maxRedirects || 5,
      httpAgent,
      httpsAgent,
      ...options
    };

    try {
      return await axios(url, config);
    } catch (err) {
      // Don't leak internal axios errors to callers if possible
      throw err;
    }
  }

  async get(url, config = {}) {
    return this.request(url, { ...config, method: "GET" });
  }

  async post(url, data, config = {}) {
    return this.request(url, { ...config, method: "POST", data });
  }

  async put(url, data, config = {}) {
    return this.request(url, { ...config, method: "PUT", data });
  }

  async delete(url, config = {}) {
    return this.request(url, { ...config, method: "DELETE" });
  }
}

module.exports = new RequestService();
