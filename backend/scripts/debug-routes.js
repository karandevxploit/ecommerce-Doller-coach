const app = require("../server");
const listEndpoints = require("express-list-endpoints");

/**
 * NORMALIZE PATH
 * /users/:id → /users/:param
 */
function normalizePath(path) {
  return path.replace(/:[^/]+/g, ":param");
}

console.log("\n--- STARTING ROUTE AUDIT ---\n");

const endpoints = listEndpoints(app);

const seen = new Map();
const duplicates = [];
const stats = {
  total: 0,
  methods: {},
};

endpoints.forEach(route => {
  const normalizedPath = normalizePath(route.path);

  route.methods.forEach(method => {
    const key = `${method} ${normalizedPath}`;

    stats.total++;
    stats.methods[method] = (stats.methods[method] || 0) + 1;

    if (seen.has(key)) {
      duplicates.push({
        route: key,
        original: route.path,
        previous: seen.get(key),
      });
    } else {
      seen.set(key, route.path);
    }
  });
});

/**
 * OUTPUT
 */
if (duplicates.length > 0) {
  console.log("❌ DUPLICATE ROUTES DETECTED:\n");

  duplicates.forEach(d => {
    console.log(`⚠️ ${d.route}`);
    console.log(`   Current: ${d.original}`);
    console.log(`   Previous: ${d.previous}\n`);
  });
} else {
  console.log("✅ No duplicate routes found.\n");
}

/**
 * STATS
 */
console.log("📊 ROUTE STATS:");
console.log(JSON.stringify(stats, null, 2));

/**
 * OPTIONAL: JSON OUTPUT FOR CI
 */
if (process.env.JSON === "true") {
  console.log(
    JSON.stringify({
      duplicates,
      stats,
    })
  );
}

/**
 * EXIT CODE
 */
process.exit(duplicates.length > 0 ? 1 : 0);