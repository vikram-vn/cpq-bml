export default [
  {
    files: ["**/*.js", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        Buffer: "readonly",
        URL: "readonly",
        global: "readonly",
        suite: "readonly",
        test: "readonly",
        suiteSetup: "readonly",
        suiteTeardown: "readonly",
        setup: "readonly",
        teardown: "readonly",
      },
    },
    rules: {},
  },
  {
    files: ["**/*.mjs", "app/lang/settings-panel/web-view/**", "eslint.config.mjs", ".vscode-test.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        process: "readonly",
        acquireVsCodeApi: "readonly",
      },
    },
    rules: {},
  },
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.vscode-test/**",
      "**/out/**",
      "**/*.min.json",
      "**/*.tmLanguage.min.json",
    ],
  },
];
