const dns = require("dns").promises;
const { URL } = require("url");
const logger = require("./logger");

/**
 * SSRF Prevention Utility
 * Validates outgoing URLs against protocol restrictions and internal IP ranges.
 */

const BLACKLISTED_IP_RANGES = [
  /^127\./,              // Loopback 127.0.0.0/8
  /^10\./,               // Private RFC1918 10.0.0.0/8
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Private RFC1918 172.16.0.0/12
  /^192\.168\./,         // Private RFC1918 192.168.0.0/16
  /^169\.254\./,         // Link-Local 169.254.0.0/16 (Metadata)
  /^0\./,                // Current network
  /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Shared space 100.64.0.0/10
  /^::1$/,               // IPv6 Loopback
  /^[fF][cCdD]/,         // IPv6 Private fc00::/7
  /^[fF][eE][89aAbB]/    // IPv6 Link-Local fe80::/10
];

const ALLOWED_PROTOCOLS = ["http:", "https:"];

/**
 * Validates a URL and resolves hostname to ensure it doesn't hit a blacklisted IP.
 * @param {string} urlString 
 * @returns {Promise<boolean>}
 */
exports.validateUrlForSSRF = async (urlString) => {
  try {
    const parsedUrl = new URL(urlString);

    // 1. Protocol Validation
    if (!ALLOWED_PROTOCOLS.includes(parsedUrl.protocol)) {
      logger.warn(`[SSRF_V1] Rejected Protocol: ${parsedUrl.protocol} for ${urlString}`);
      return false;
    }

    const { hostname } = parsedUrl;

    // 2. Hostname Validation (Check if it's already an IP)
    if (isIpBlacklisted(hostname)) {
      logger.error(`[SSRF_V1] Direct IP Blacklist Hit: ${hostname}`);
      return false;
    }

    // 3. DNS Resolution (Prevents DNS Rebinding bypass)
    try {
      const addresses = await dns.lookup(hostname, { all: true });
      let safeIp = null;
      for (const addr of addresses) {
        if (isIpBlacklisted(addr.address)) {
          logger.error(`[SSRF_V1] DNS Resolved Blacklist Hit: ${hostname} -> ${addr.address}`);
          return { safe: false };
        }
        if (!safeIp) safeIp = addr.address;
      }
      return { safe: true, ip: safeIp, parsedUrl };
    } catch (dnsErr) {
      logger.error(`[SSRF_V1] DNS Resolution Failed for ${hostname}`);
      return { safe: false };
    }
  } catch (err) {
    logger.error(`[SSRF_V1] URL Parsing Failed: ${err.message}`);
    return { safe: false };
  }
};

/**
 * Checks if a string IP address falls into blacklisted ranges.
 */
function isIpBlacklisted(ip) {
  return BLACKLISTED_IP_RANGES.some(range => range.test(ip));
}
