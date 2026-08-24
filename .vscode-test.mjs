import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'test/**/*.test.js',
	launchArgs: ['--user-data-dir', 'C:/Users/Vikram-N/.vscode-test-data'],
});
