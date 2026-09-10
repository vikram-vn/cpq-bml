const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "..");
const APP_DIR = path.join(ROOT, "app");

function getAllJsFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip web-view frontend code (React/browser bundle)
      if (entry.name === "web-view" || entry.name === "node_modules") continue;
      files.push(...getAllJsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  }
  return files;
}

suite("Codebase Import/Export Integrity", () => {
  test("all destructured requires in app/ resolve to defined exports", () => {
    const jsFiles = getAllJsFiles(APP_DIR);
    jsFiles.push(path.join(ROOT, "extension.js"));

    // Pattern to match: const { a, b: alias, c } = require("...");
    const destructureRegex = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    const missingImports = [];

    for (const file of jsFiles) {
      const content = fs.readFileSync(file, "utf8");
      let match;
      destructureRegex.lastIndex = 0;

      while ((match = destructureRegex.exec(content)) !== null) {
        const rawImports = match[1];
        const modulePath = match[2];

        // Skip non-local requires (external packages like vscode, fs, path, etc.)
        const isLocal = modulePath.startsWith(".") || modulePath.startsWith("@/");
        if (!isLocal) continue;

        let resolvedModule;
        try {
          if (modulePath.startsWith("@/")) {
            const sub = modulePath.slice(2);
            resolvedModule = require(path.join(ROOT, "app", sub));
          } else {
            const targetDir = path.dirname(file);
            resolvedModule = require(path.resolve(targetDir, modulePath));
          }
        } catch (err) {
          missingImports.push({
            file: path.relative(ROOT, file),
            modulePath,
            error: `Failed to load module: ${err.message}`,
          });
          continue;
        }

        if (!resolvedModule || typeof resolvedModule !== "object") {
          continue;
        }

        // Parse individual imported identifiers
        const importParts = rawImports.split(",");
        for (const part of importParts) {
          const trimmed = part.trim();
          if (!trimmed) continue;
          // Handle "originalName: alias" or "originalName"
          const originalName = trimmed.split(":")[0].trim();
          // Skip comments or non-identifiers
          if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(originalName)) continue;

          if (resolvedModule[originalName] === undefined) {
            missingImports.push({
              file: path.relative(ROOT, file),
              modulePath,
              missingSymbol: originalName,
              exportedKeys: Object.keys(resolvedModule),
            });
          }
        }
      }
    }

    if (missingImports.length > 0) {
      const details = missingImports
        .map((m) =>
          m.missingSymbol
            ? `  - [${m.file}] requires '${m.missingSymbol}' from '${m.modulePath}', but it was undefined! Available exports: [${m.exportedKeys.join(", ")}]`
            : `  - [${m.file}] failed requiring '${m.modulePath}': ${m.error}`,
        )
        .join("\n");
      assert.fail(`Found ${missingImports.length} broken/undefined import(s):\n${details}`);
    }
  });
});
