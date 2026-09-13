const fs = require('fs');
const path = require('path');

function stripSvg(content) {
  return content
    // Remove XML declaration and doctype
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<!DOCTYPE[^>]*>/gi, '')
    // Remove comments
    .replace(/<!--[\s\S]*?-->/g, '')
    // Remove metadata, title, desc elements
    .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
    .replace(/<desc[\s\S]*?<\/desc>/gi, '')
    .replace(/<title[\s\S]*?<\/title>/gi, '')
    // Remove editor-specific attributes
    .replace(/\s*(?:xmlns:sketch|xmlns:inkscape|xmlns:sodipodi|xmlns:adobe|inkscape:[a-z0-9\-]+|sodipodi:[a-z0-9\-]+|sketch:[a-z0-9\-]+|data-name)="[^"]*"/gi, '')
    // Collapse consecutive whitespace and newlines
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function findSvgs(dir, list = []) {
  if (!fs.existsSync(dir)) return list;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory() && f.name !== 'node_modules' && f.name !== '.git') {
      findSvgs(full, list);
    } else if (f.isFile() && f.name.endsWith('.svg')) {
      list.push(full);
    }
  }
  return list;
}

function processAllSvgs(targetDir = path.join(__dirname, '..', '..', 'app', 'icons'), dryRun = false) {
  const svgs = findSvgs(targetDir);
  let origTotal = 0;
  let minTotal = 0;
  let fileCount = 0;

  for (const p of svgs) {
    const orig = fs.readFileSync(p, 'utf8');
    const stripped = stripSvg(orig);
    origTotal += orig.length;
    minTotal += stripped.length;
    fileCount++;
    if (!dryRun && orig !== stripped) {
      fs.writeFileSync(p, stripped, 'utf8');
    }
  }

  const saved = origTotal - minTotal;
  const pct = origTotal > 0 ? ((saved / origTotal) * 100).toFixed(1) : '0.0';
  if (saved > 0) {
    console.log(`Optimized ${fileCount} SVGs: ${(origTotal / 1024).toFixed(1)} KB -> ${(minTotal / 1024).toFixed(1)} KB (saved ${(saved / 1024).toFixed(1)} KB, ${pct}%)`);
  } else {
    console.log(`All ${fileCount} SVGs verified clean (${(minTotal / 1024).toFixed(1)} KB)`);
  }
  return { fileCount, origTotal, minTotal, saved };
}

if (require.main === module) {
  processAllSvgs(undefined, false);
}

module.exports = {
  stripSvg,
  processAllSvgs
};
