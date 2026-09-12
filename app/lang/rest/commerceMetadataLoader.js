const fs = require("fs");
const path = require("path");
const {
  COMMERCE_DIR,
  SYSTEM_DIR,
  CONFIG_DIR,
  COMMERCE_ATTRS_FILE,
  CONFIG_ATTRS_FILE,
  SYSTEM_ATTRS_FILE,
} = require("@/lang/rest/commerceAttributesWriter");

function processCommercePayload(raw, addItems, defaultScope = "Transaction") {
  if (!raw) return;
  if (raw.standardProcess && raw.standardProcess.attributes) {
    addItems(raw.standardProcess.attributes, "Transaction");
  }
  if (raw.processes && typeof raw.processes === "object") {
    for (const p of Object.values(raw.processes)) {
      if (p && p.attributes) addItems(p.attributes, "Transaction");
    }
  }
  if (raw.lookups) {
    if (Array.isArray(raw.lookups.transaction)) addItems(raw.lookups.transaction, "Transaction");
    if (Array.isArray(raw.lookups.transactionLine)) addItems(raw.lookups.transactionLine, "Line Item");
    if (Array.isArray(raw.lookups.arraySets)) addItems(raw.lookups.arraySets, "Array Set");
    if (raw.lookups.custom && typeof raw.lookups.custom === "object") {
      for (const ca of Object.values(raw.lookups.custom)) {
        if (Array.isArray(ca)) addItems(ca, "Transaction");
      }
    }
  }
  if (Array.isArray(raw.attributes)) addItems(raw.attributes, defaultScope);
  if (Array.isArray(raw.items)) addItems(raw.items, defaultScope);
  if (Array.isArray(raw.lineAttributes)) addItems(raw.lineAttributes, "Line Item");
  if (Array.isArray(raw.arraySets)) addItems(raw.arraySets, "Array Set");
  if (Array.isArray(raw)) addItems(raw, defaultScope);
}

function loadAttributesFromDir(dir, index, addItems) {
  if (!dir || !fs.existsSync(dir)) return false;

  const flatCommerce = path.join(dir, COMMERCE_ATTRS_FILE);
  const flatConfig = path.join(dir, CONFIG_ATTRS_FILE);
  const flatSystem = path.join(dir, SYSTEM_ATTRS_FILE);

  let loadedAny = false;
  if (fs.existsSync(flatCommerce)) {
    try {
      processCommercePayload(JSON.parse(fs.readFileSync(flatCommerce, "utf8")), addItems);
      loadedAny = true;
    } catch (e) {}
  }
  if (fs.existsSync(flatSystem)) {
    try {
      const raw = JSON.parse(fs.readFileSync(flatSystem, "utf8"));
      addItems(raw.items || raw.attributes || (Array.isArray(raw) ? raw : []), "System");
      loadedAny = true;
    } catch (e) {}
  }
  if (fs.existsSync(flatConfig)) {
    try {
      const raw = JSON.parse(fs.readFileSync(flatConfig, "utf8"));
      addItems(raw.attributes || raw.items || (Array.isArray(raw) ? raw : []), "Configuration");
      if (Array.isArray(raw.models)) addItems(raw.models, "Model");
      if (Array.isArray(raw.productFamilies)) addItems(raw.productFamilies, "Configuration");
      loadedAny = true;
    } catch (e) {}
  }
  if (loadedAny) return true;

  // Subfolders: commerce/<process>/attributes.min.json, config/<family>/attributes.min.json, system/variables.min.json
  const commDir = path.join(dir, COMMERCE_DIR);
  const cfgDir = path.join(dir, CONFIG_DIR);
  const sysDir = path.join(dir, SYSTEM_DIR);

  if (fs.existsSync(commDir)) {
    try {
      for (const entry of fs.readdirSync(commDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const procDir = path.join(commDir, entry.name);
          for (const subFile of fs.readdirSync(procDir)) {
            if (!subFile.endsWith(".min.json")) continue;
            try {
              const raw = JSON.parse(fs.readFileSync(path.join(procDir, subFile), "utf8"));
              processCommercePayload(raw, addItems);
              loadedAny = true;
            } catch (e) {}
          }
        } else if (entry.isFile() && entry.name.endsWith(".min.json")) {
          try {
            const raw = JSON.parse(fs.readFileSync(path.join(commDir, entry.name), "utf8"));
            processCommercePayload(raw, addItems);
            loadedAny = true;
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  if (fs.existsSync(cfgDir)) {
    try {
      for (const entry of fs.readdirSync(cfgDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const famDir = path.join(cfgDir, entry.name);
          for (const subFile of fs.readdirSync(famDir)) {
            if (!subFile.endsWith(".min.json")) continue;
            try {
              const raw = JSON.parse(fs.readFileSync(path.join(famDir, subFile), "utf8"));
              const items = Array.isArray(raw) ? raw : Array.isArray(raw.attributes) ? raw.attributes : Array.isArray(raw.items) ? raw.items : [];
              addItems(items, "Configuration");
              if (Array.isArray(raw.models)) addItems(raw.models, "Model");
              if (Array.isArray(raw.productFamilies)) addItems(raw.productFamilies, "Configuration");
              loadedAny = true;
            } catch (e) {}
          }
        } else if (entry.isFile() && entry.name.endsWith(".min.json")) {
          try {
            const raw = JSON.parse(fs.readFileSync(path.join(cfgDir, entry.name), "utf8"));
            const items = Array.isArray(raw) ? raw : Array.isArray(raw.attributes) ? raw.attributes : Array.isArray(raw.items) ? raw.items : [];
            addItems(items, "Configuration");
            if (Array.isArray(raw.models)) addItems(raw.models, "Model");
            if (Array.isArray(raw.productFamilies)) addItems(raw.productFamilies, "Configuration");
            loadedAny = true;
          } catch (e) {}
        }
      }
    } catch (e) {}
  }

  if (fs.existsSync(sysDir)) {
    try {
      for (const f of fs.readdirSync(sysDir)) {
        if (!f.endsWith(".min.json")) continue;
        try {
          const raw = JSON.parse(fs.readFileSync(path.join(sysDir, f), "utf8"));
          addItems(raw.items || raw.attributes || (Array.isArray(raw) ? raw : []), "System");
          loadedAny = true;
        } catch (e) {}
      }
    } catch (e) {}
  }

  return loadedAny;
}

function inspectMetadataStatus(dirs, vscode, backendDir) {
  let isSynced = false;
  let updatedAt = null;
  let commerceCount = 0;
  let configCount = 0;
  let systemCount = 0;

  for (const dir of dirs) {
    // 1. Check modular commerce/<process>/attributes.min.json
    const commDir = path.join(dir, COMMERCE_DIR);
    if (fs.existsSync(commDir)) {
      try {
        for (const entry of fs.readdirSync(commDir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            const p = path.join(commDir, entry.name, "attributes.min.json");
            if (fs.existsSync(p)) {
              const raw = JSON.parse(fs.readFileSync(p, "utf8"));
              isSynced = true;
              updatedAt = raw.updatedAt || updatedAt;
              commerceCount += raw.count || (Array.isArray(raw.attributes) ? raw.attributes.length : 0);
            }
          }
        }
      } catch (e) {}
    }
    const commFile = path.join(dir, COMMERCE_ATTRS_FILE);
    if (fs.existsSync(commFile) && commerceCount === 0) {
      try {
        const raw = JSON.parse(fs.readFileSync(commFile, "utf8"));
        isSynced = true;
        updatedAt = raw.updatedAt || updatedAt;
        commerceCount = raw.count || (Array.isArray(raw.attributes) ? raw.attributes.length : 0);
      } catch (e) {}
    }

    // 2. Check modular config/<productFamily>/attributes.min.json and config/general.attributes.min.json
    const cfgDir = path.join(dir, CONFIG_DIR);
    if (fs.existsSync(cfgDir)) {
      try {
        for (const entry of fs.readdirSync(cfgDir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            const p = path.join(cfgDir, entry.name, "attributes.min.json");
            if (fs.existsSync(p)) {
              const raw = JSON.parse(fs.readFileSync(p, "utf8"));
              isSynced = true;
              updatedAt = raw.updatedAt || updatedAt;
              configCount += raw.count || (Array.isArray(raw.attributes) ? raw.attributes.length : 0);
            }
          } else if (entry.isFile() && entry.name.endsWith(".min.json")) {
            const p = path.join(cfgDir, entry.name);
            const raw = JSON.parse(fs.readFileSync(p, "utf8"));
            isSynced = true;
            updatedAt = raw.updatedAt || updatedAt;
            configCount += raw.count || (Array.isArray(raw.attributes) ? raw.attributes.length : 0);
          }
        }
      } catch (e) {}
    }
    const cfgFile = path.join(dir, CONFIG_ATTRS_FILE);
    if (fs.existsSync(cfgFile) && configCount === 0) {
      try {
        const raw = JSON.parse(fs.readFileSync(cfgFile, "utf8"));
        isSynced = true;
        updatedAt = raw.updatedAt || updatedAt;
        configCount = raw.count || (Array.isArray(raw.attributes) ? raw.attributes.length : 0);
      } catch (e) {}
    }

    // 3. Check modular system/variables.min.json
    const sysDir = path.join(dir, SYSTEM_DIR);
    if (fs.existsSync(sysDir)) {
      try {
        const vf = path.join(sysDir, "variables.min.json");
        if (fs.existsSync(vf)) {
          const raw = JSON.parse(fs.readFileSync(vf, "utf8"));
          systemCount = raw.count || (Array.isArray(raw.items) ? raw.items.length : 0);
        }
      } catch (e) {}
    }
    const sysFile = path.join(dir, SYSTEM_ATTRS_FILE);
    if (fs.existsSync(sysFile) && systemCount === 0) {
      try {
        const raw = JSON.parse(fs.readFileSync(sysFile, "utf8"));
        systemCount = raw.count || (Array.isArray(raw.items) ? raw.items.length : 0);
      } catch (e) {}
    }

    if (isSynced) break;
  }

  let canSync = false;
  if (vscode) {
    const cpqConfig = vscode.workspace.getConfiguration("cpqBml");
    const enabled = cpqConfig.get("connection.enabled", true);
    const siteUrl = (cpqConfig.get("connection.siteUrl", "") || "").trim();
    canSync = Boolean(enabled && siteUrl);
  }

  return {
    isSynced,
    updatedAt,
    commerceCount,
    configCount,
    systemCount,
    canSync,
    storagePath: backendDir || "",
  };
}

function removeMetadataFromDirs(dirs, cpqDirName) {
  const targetDirs = Array.isArray(dirs) ? dirs : [];
  for (const rawDir of targetDirs) {
    if (!rawDir) continue;
    const dir = path.normalize(rawDir);
    if (!fs.existsSync(dir)) continue;

    const baseName = path.basename(dir).toLowerCase();
    const isDedicatedDir =
      baseName === (cpqDirName || "cpq").toLowerCase() ||
      baseName === "cpq" ||
      baseName === "metadata";

    if (isDedicatedDir) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        continue;
      } catch (e) {
        // If directory locking prevents deleting the folder itself, delete contents below
      }
    }

    const knownFiles = [
      COMMERCE_ATTRS_FILE,
      CONFIG_ATTRS_FILE,
      SYSTEM_ATTRS_FILE,
      "commerce.attributes.json",
      "config.attributes.json",
      "system.attributes.json",
      "README.md",
    ];
    for (const f of knownFiles) {
      const p = path.join(dir, f);
      if (fs.existsSync(p)) {
        try { fs.unlinkSync(p); } catch (e) {}
      }
    }
    for (const sub of ["commerce", "config", "system", "cache"]) {
      const p = path.join(dir, sub);
      if (fs.existsSync(p)) {
        try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) {}
      }
    }
    try {
      const remaining = fs.readdirSync(dir);
      if (remaining.length === 0) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    } catch (e) {}
  }
}

module.exports = {
  loadAttributesFromDir,
  inspectMetadataStatus,
  removeMetadataFromDirs,
};
