/**
 * Utility for IP normalization and subnet extraction.
 * Protects against botnets rotating through common ISP /24 ranges.
 */

/**
 * Normalizes IPv4 and IPv6 addresses.
 * IPv4: extracts /24 subnet (e.g. 1.2.3.4 -> 1.2.3.0)
 * IPv6: extracts /64 prefix (standard residential subnet)
 */


/**
 * Normalizes IPv4 and IPv6 addresses and extracts identity signals.
 */
exports.getExtractionKeys = (req) => {
  const ip = req.ip || req.headers["x-forwarded-for"] || "0.0.0.0";
  const userId = req.user?._id?.toString() || null;

  let subnet = "unknown-subnet";
  let normalizedIp = ip;

  // IPv4 handling
  if (ip.includes(".")) {
    const parts = ip.split(".");
    if (parts.length === 4) {
      subnet = `${parts[0]}.${parts[1]}.${parts[2]}.0`;
      normalizedIp = ip;
    }
  } 
  // IPv6 handling
  else if (ip.includes(":")) {
    const parts = ip.split(":");
    if (parts.length >= 4) {
      subnet = parts.slice(0, 4).join(":") + "::/64";
      normalizedIp = ip;
    }
  }

  return { 
    userId, 
    ip: normalizedIp, 
    subnet
  };
};
