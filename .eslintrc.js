module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint/eslint-plugin',
    'import',
    'unused-imports',
    'prefer-arrow',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  ignorePatterns: ['.eslintrc.js', 'dist/', 'node_modules/', 'migrations/'],
  rules: {
    // === ERROR DETECTION & SECURITY ===
    // Catch potential runtime errors
    '@typescript-eslint/no-unused-vars': ['error', { 
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_',
      destructuredArrayIgnorePattern: '^_'
    }],
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': 'off',

    // Prevent common mistakes
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    
    // === TYPE SAFETY ===
    '@typescript-eslint/no-unsafe-assignment': 'error',
    '@typescript-eslint/no-unsafe-argument': 'error',
    '@typescript-eslint/no-unsafe-call': 'error',
    '@typescript-eslint/no-unsafe-member-access': 'error',
    '@typescript-eslint/no-unsafe-return': 'error',
    
    // Security & Best Practices
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-new-func': 'error',
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'error',

    // === DATABASE & MULTI-TENANT SAFETY ===
    'no-restricted-syntax': [
      'error',
      {
        selector: "CallExpression[callee.property.name='findAll'][arguments.length=0]",
        message: 'findAll() without WHERE clause detected. Always include company_id for multi-tenant isolation.'
      },
      {
        selector: "CallExpression[callee.property.name='findOne'][arguments.length=0]",
        message: 'findOne() without WHERE clause detected. Always include company_id for multi-tenant isolation.'
      }
    ],

    // === RELAXED RULES (practical for development) ===
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    '@typescript-eslint/ban-ts-comment': 'warn',
    'prefer-const': 'warn',
    
    // === FORMATTING (handled by Prettier) ===
    'prettier/prettier': ['error', {
      endOfLine: 'auto'
    }]
  },
  overrides: [
    // Relaxed rules for test files but keep type safety
    {
      files: ['**/*.spec.ts', '**/*.test.ts', '**/test/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
        'no-console': 'off',
        '@typescript-eslint/explicit-member-accessibility': 'off',
        'unused-imports/no-unused-imports': 'warn', // Keep as warning
        '@typescript-eslint/no-unused-vars': 'warn', // Keep as warning
        // Keep type safety rules enabled for tests
        '@typescript-eslint/no-unsafe-assignment': 'warn',
        '@typescript-eslint/no-unsafe-argument': 'warn',
        '@typescript-eslint/no-unsafe-call': 'warn',
        '@typescript-eslint/no-unsafe-member-access': 'warn',
        '@typescript-eslint/no-unsafe-return': 'warn'
      }
    },
    // Relaxed rules for migration files
    {
      files: ['migrations/**/*.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'no-console': 'off'
      }
    },
    // Relaxed rules for config files
    {
      files: ['*.config.js', '*.config.ts'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off'
      }
    }
  ]
};