const NodeCache = require("node-cache");
const cache = new NodeCache({ stdTTL: 300, checkperiod: 320 });

exports.cacheRoute = (req, res, next) => {
  if (req.method !== "GET") {
    return next();
  }
  
  const key = req.originalUrl;
  const cachedResponse = cache.get(key);
  
  if (cachedResponse) {
    return res.json(cachedResponse);
  }
  
  const originalJson = res.json;
  res.json = (body) => {
    cache.set(key, body);
    originalJson.call(res, body);
  };
  
  next();
};

exports.clearCache = () => {
  cache.flushAll();
};
