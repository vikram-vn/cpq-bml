const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');

// 1. Remove existing .vsix files to avoid interactive overwrite prompt
const existingVsix = fs.readdirSync(ROOT).filter(f => f.endsWith('.vsix'));
for (const f of existingVsix) {
    try {
        fs.unlinkSync(path.join(ROOT, f));
    } catch (e) {
        // ignore
    }
}

// 2. Run vsce package non-interactively
process.env.VSCE_TESTS = '1';

const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = [
    '@vscode/vsce',
    'package',
    '--no-yarn',
    '--no-dependencies',
    '--allow-missing-repository',
    '--skip-license'
];

console.log('Packaging extension with @vscode/vsce...');
const cmd = `${npxCmd} ${args.join(' ')}`;
const result = spawnSync(cmd, {
    cwd: ROOT,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, VSCE_TESTS: '1' }
});

if (result.status !== 0) {
    console.error('Packaging failed with exit code:', result.status);
    process.exit(result.status || 1);
}

// 3. Verify final .vsix size
const finalVsix = fs.readdirSync(ROOT).filter(f => f.endsWith('.vsix'));
if (finalVsix.length > 0) {
    const vsixPath = path.join(ROOT, finalVsix[0]);
    const stat = fs.statSync(vsixPath);
    const kb = stat.size / 1024;
    const mb = kb / 1024;
    console.log(`\n========================================`);
    console.log(`Package: ${finalVsix[0]}`);
    console.log(`Size:    ${stat.size} bytes (${kb.toFixed(2)} KB, ${mb.toFixed(3)} MB)`);
    console.log(`Status:  ${kb < 1024 ? 'PASSED (< 1 MB)' : 'FAILED (>= 1 MB)'}`);
    console.log(`========================================\n`);
}
