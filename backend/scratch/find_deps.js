const fs = require("fs/promises");
const path = require("path");
const os = require("os");

/**
 * IGNORE DIRECTORIES
 */
const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
]);

/**
 * GET ALL JS FILES (ASYNC + RECURSIVE)
 */
async function getFiles(dir) {
  let results = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);

        if (IGNORE_DIRS.has(entry.name)) return;

        if (entry.isDirectory()) {
          const nested = await getFiles(fullPath);
          results = results.concat(nested);
        } else if (entry.name.endsWith(".js")) {
          results.push(fullPath);
        }
      })
    );
  } catch (err) {
    console.error(`Error reading ${dir}:`, err.message);
  }

  return results;
}

/**
 * NORMALIZE PACKAGE NAME
 * lodash/map → lodash
 */
function normalizePackage(pkg) {
  if (pkg.startsWith("@")) {
    return pkg.split("/").slice(0, 2).join("/");
  }
  return pkg.split("/")[0];
}

/**
 * EXTRACT DEPENDENCIES
 */
function extractDeps(content) {
  const deps = new Set();

  const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
  const importRegex = /from\s+['"]([^'"]+)['"]/g;

  let match;

  while ((match = requireRegex.exec(content))) {
    if (!match[1].startsWith(".")) {
      deps.add(normalizePackage(match[1]));
    }
  }

  while ((match = importRegex.exec(content))) {
    if (!match[1].startsWith(".")) {
      deps.add(normalizePackage(match[1]));
    }
  }

  return deps;
}

/**
 * PROCESS FILE
 */
async function processFile(file) {
  try {
    const content = await fs.readFile(file, "utf8");
    return extractDeps(content);
  } catch (err) {
    console.error(`Error reading ${file}:`, err.message);
    return new Set();
  }
}

/**
 * MAIN
 */
(async () => {
  const files = await getFiles(".");

  const concurrency = os.cpus().length;
  let allDeps = new Set();

  for (let i = 0; i < files.length; i += concurrency) {
    const chunk = files.slice(i, i + concurrency);

    const results = await Promise.all(chunk.map(processFile));

    results.forEach((set) => {
      set.forEach((dep) => allDeps.add(dep));
    });
  }

  console.log(
    JSON.stringify(Array.from(allDeps).sort(), null, 2)
  );
})();