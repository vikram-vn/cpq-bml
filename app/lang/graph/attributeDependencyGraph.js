const fs = require('fs');
const path = require('path');

/**
 * Static analyzer extracting attribute reads/writes and building
 * directed dependency graphs across CPQ Commerce & Utility BML files.
 */
class AttributeDependencyGraph {
  constructor(workspaceRoot) {
    this.workspaceRoot = workspaceRoot;
    this.nodes = new Map();
    this.edges = [];
    this.phases = {
      VALIDATION: [],
      HIDING: [],
      CONSTRAINT: [],
      PRICING: [],
      SUBMITTAL: []
    };
  }

  static categorizePhase(filePath, content) {
    const lowerPath = filePath.toLowerCase();
    const lowerContent = content.toLowerCase();

    if (lowerPath.includes('validation') || lowerContent.includes('@rule validation') || lowerContent.includes('returntype: string')) {
      return 'VALIDATION';
    }
    if (lowerPath.includes('hiding') || lowerContent.includes('@rule hiding') || lowerContent.includes('returntype: boolean')) {
      return 'HIDING';
    }
    if (lowerPath.includes('constraint') || lowerContent.includes('@rule constraint')) {
      return 'CONSTRAINT';
    }
    if (lowerPath.includes('submittal') || lowerPath.includes('action') || lowerContent.includes('@action')) {
      return 'SUBMITTAL';
    }
    return 'PRICING'; // Default for formulas / modify scripts / util
  }

  static extractAttributeReads(code) {
    const reads = new Set();
    const writes = new Set(AttributeDependencyGraph.extractAttributeWrites(code));

    // Remove put(dict, "attr") occurrences so written attributes are not marked as reads
    const sanitizedCode = code.replace(/put\s*\(\s*[^,]+,\s*["'][^"']+["']/g, '');

    // 1. Direct attribute access: _quote_process_id, status_t, total_amount_t
    const directRegex = /\b([a-zA-Z0-9_]+_(?:t|l|q|doc))\b/g;
    let m;
    while ((m = directRegex.exec(sanitizedCode)) !== null) {
      if (!writes.has(m[1])) {
        reads.add(m[1]);
      }
    }

    // 2. Dictionary get pattern: get(dict, "attr_name")
    const dictGetRegex = /get\s*\(\s*[a-zA-Z0-9_]+\s*,\s*["']([a-zA-Z0-9_]+)["']\s*\)/g;
    while ((m = dictGetRegex.exec(code)) !== null) {
      reads.add(m[1]);
    }

    // 3. Document attribute reference: commerce.attribute_name or doc.attr
    const docAttrRegex = /(?:commerce|doc|doc1|doc2)\.([a-zA-Z0-9_]+)/g;
    while ((m = docAttrRegex.exec(code)) !== null) {
      reads.add(m[1]);
    }

    return Array.from(reads);
  }

  static extractAttributeWrites(code) {
    const writes = new Set();

    // 1. Dictionary put pattern: put(dict, "attr_name", value)
    const dictPutRegex = /put\s*\(\s*[a-zA-Z0-9_]+\s*,\s*["']([a-zA-Z0-9_]+)["']\s*,/g;
    let m;
    while ((m = dictPutRegex.exec(code)) !== null) {
      writes.add(m[1]);
    }

    // 2. Attribute assignment pattern: attr_t = value
    const assignRegex = /\b([a-zA-Z0-9_]+_(?:t|l|q))\s*=(?!=)/g;
    while ((m = assignRegex.exec(code)) !== null) {
      writes.add(m[1]);
    }

    return Array.from(writes);
  }

  analyzeCode(scriptId, code, filePath = '') {
    const phase = AttributeDependencyGraph.categorizePhase(filePath, code);

    // Register rule/script node
    this.nodes.set(scriptId, {
      id: scriptId,
      label: path.basename(filePath || scriptId),
      type: 'rule',
      phase,
      filePath
    });

    if (this.phases[phase]) {
      this.phases[phase].push(scriptId);
    }

    const reads = AttributeDependencyGraph.extractAttributeReads(code);
    const writes = AttributeDependencyGraph.extractAttributeWrites(code);

    // Register attribute nodes and edges
    for (const attr of reads) {
      if (!this.nodes.has(attr)) {
        this.nodes.set(attr, {
          id: attr,
          label: attr,
          type: 'attribute',
          phase: null,
          filePath: null
        });
      }
      this.edges.push({ from: scriptId, to: attr, type: 'READS' });
    }

    for (const attr of writes) {
      if (!this.nodes.has(attr)) {
        this.nodes.set(attr, {
          id: attr,
          label: attr,
          type: 'attribute',
          phase: null,
          filePath: null
        });
      }
      this.edges.push({ from: scriptId, to: attr, type: 'WRITES' });
    }
  }

  scanWorkspace(targetDir = this.workspaceRoot) {
    if (!targetDir || !fs.existsSync(targetDir)) return;

    const findBmlFiles = (dir) => {
      const files = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...findBmlFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.bml') && !entry.name.endsWith('.test.bml')) {
          files.push(fullPath);
        }
      }
      return files;
    };

    const bmlFiles = findBmlFiles(targetDir);
    for (const file of bmlFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        const scriptId = path.relative(targetDir, file).replace(/\\/g, '/');
        this.analyzeCode(scriptId, content, file);
      } catch {
        // Skip unreadable files
      }
    }
  }

  detectCycles() {
    // Build adjacency list for rule-to-rule dependencies via attributes
    // Rule A writes Attr X, Rule B reads Attr X -> Directed edge Rule A -> Rule B
    const writersOf = new Map();
    const readersOf = new Map();

    for (const edge of this.edges) {
      if (edge.type === 'WRITES') {
        if (!writersOf.has(edge.to)) writersOf.set(edge.to, []);
        writersOf.get(edge.to).push(edge.from);
      } else if (edge.type === 'READS') {
        if (!readersOf.has(edge.to)) readersOf.set(edge.to, []);
        readersOf.get(edge.to).push(edge.from);
      }
    }

    const adj = new Map();
    for (const [attr, writers] of writersOf.entries()) {
      const readers = readersOf.get(attr) || [];
      for (const w of writers) {
        if (!adj.has(w)) adj.set(w, new Set());
        for (const r of readers) {
          if (w !== r) {
            adj.get(w).add(r);
          }
        }
      }
    }

    // DFS Cycle Detection
    const cycles = [];
    const visited = new Set();
    const recStack = new Set();
    const currentPath = [];

    const dfs = (node) => {
      visited.add(node);
      recStack.add(node);
      currentPath.push(node);

      const neighbors = adj.get(node) || new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor);
        } else if (recStack.has(neighbor)) {
          const cycleStartIndex = currentPath.indexOf(neighbor);
          if (cycleStartIndex !== -1) {
            cycles.push([...currentPath.slice(cycleStartIndex), neighbor]);
          }
        }
      }

      recStack.delete(node);
      currentPath.pop();
    };

    for (const node of adj.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return cycles;
  }

  toGraphModel() {
    const cycles = this.detectCycles();
    const nodesArray = Array.from(this.nodes.values());

    return {
      nodes: nodesArray,
      edges: this.edges,
      phases: this.phases,
      cycles,
      stats: {
        totalNodes: nodesArray.length,
        rulesCount: nodesArray.filter(n => n.type === 'rule').length,
        attributesCount: nodesArray.filter(n => n.type === 'attribute').length,
        totalEdges: this.edges.length,
        cyclesCount: cycles.length
      }
    };
  }
}

module.exports = { AttributeDependencyGraph };
