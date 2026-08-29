import { defineConfig } from '@vscode/test-cli';

import os from 'os';
import path from 'path';

export default defineConfig({
	files: 'test/**/*.test.js',
	launchArgs: ['--user-data-dir', path.join(os.tmpdir(), 'vscode-test-dir-' + process.pid)],
});
