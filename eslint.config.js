// @ts-check
import js from '@eslint/js'
import { defineConfig, globalIgnores } from 'eslint/config'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import i18next from 'eslint-plugin-i18next'
// Internal file of the plugin (not in its public API): after a plugin update the path may disappear.
import i18nextDefaults from 'eslint-plugin-i18next/lib/options/defaults.js'
import reactHooks from 'eslint-plugin-react-hooks'
import { reactRefresh } from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

// Layers of src/ and their direction of dependencies
// (architecture/react-port/modules.md in the workspace, "Layers and direction of dependencies"):
// app -> features -> shared/ui, state -> storage, data, platform, i18n -> domain.
// A layer may import only layers below it; `forbidden` lists what it must not import.
const LAYERS = [
  'app',
  'features',
  'shared',
  'state',
  'storage',
  'data',
  'platform',
  'i18n',
  'domain',
]

// `storageIndexOnly`: the layer may use src/storage only through its index (the repo); key names and raw
// localStorage access stay inside the folder (architecture/react-port/storage.md, "Устройство модуля").
/** @type {Record<string, { forbidden: string[], packages?: string[], storageIndexOnly?: boolean }>} */
const LAYER_RULES = {
  app: { forbidden: [], storageIndexOnly: true },
  features: { forbidden: ['app', 'storage'] },
  'shared/ui': { forbidden: ['app', 'features', 'state', 'storage', 'data'] },
  state: { forbidden: ['app', 'features', 'shared'], storageIndexOnly: true },
  storage: {
    forbidden: ['app', 'features', 'shared', 'state', 'data', 'platform', 'i18n'],
    packages: ['react', 'react-dom', 'react-i18next', 'zustand'],
  },
  data: { forbidden: ['app', 'features', 'shared', 'state', 'storage'] },
  platform: { forbidden: ['app', 'features', 'shared', 'state', 'storage', 'data'] },
  i18n: { forbidden: ['app', 'features', 'shared', 'state', 'storage', 'data', 'platform'] },
  domain: {
    forbidden: LAYERS.filter((layer) => layer !== 'domain'),
    packages: ['react', 'react-dom', 'react-i18next', 'i18next', 'zustand'],
  },
}

/** Matches a relative import that goes through the folder `layer` (`../storage`, `../../storage/keys`). */
const layerImport = (layer) => `^\\.{1,2}/(?:.*/)?${layer}(?:/|$)`

const layerConfigs = Object.entries(LAYER_RULES).map(
  ([layer, { forbidden, packages = [], storageIndexOnly = false }]) => ({
    files: [`src/${layer}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...forbidden.map((target) => ({
              regex: layerImport(target),
              message: `src/${layer} must not import src/${target}: imports go only down the layers (architecture/react-port/modules.md).`,
            })),
            // Packages and their subpaths (`react-dom/client`, `react/jsx-runtime`).
            ...(packages.length > 0
              ? [
                  {
                    regex: `^(${packages.join('|')})(/|$)`,
                    message: `src/${layer} must not depend on these packages (architecture/react-port/modules.md).`,
                  },
                ]
              : []),
            ...(storageIndexOnly
              ? [
                  {
                    regex: '^\\.{1,2}/(?:.*/)?storage/.+',
                    message: `src/${layer} imports src/storage only through its index (architecture/react-port/storage.md).`,
                  },
                ]
              : []),
          ],
        },
      ],
    },
  }),
)

// Storage keys (architecture/react-port/storage.md, "Устройство модуля"): only src/storage/kv.ts touches
// localStorage, only src/storage/keys.ts spells key names. Generic names (done, theme, tab, ...) are
// ordinary words in code (`kind: 'theme'`, `role="tab"`), so the literal check covers the names that are
// unmistakably keys; the rest are guarded by the localStorage ban and the storage index-only imports.
const STORAGE_KEY_LITERAL = '/^(?:adult:.+|qmode|qdir|(?:deck|last|prev)_(?:ru|pl)?)$/'
const storageKeyMessage =
  'Storage key names live only in src/storage/keys.ts (architecture/react-port/storage.md).'
const storageAccessMessage =
  'localStorage is used only by src/storage/kv.ts; go through the storage repo (architecture/react-port/storage.md).'
// Caution: a later block repeating no-restricted-globals / -properties / -syntax replaces these lists
// (flat config does not merge rule options), and turning a rule "off" for kv.ts also drops future bans.
const storageConfigs = [
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/test/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'localStorage', message: storageAccessMessage },
        { name: 'sessionStorage', message: storageAccessMessage },
      ],
      'no-restricted-properties': [
        'error',
        { property: 'localStorage', message: storageAccessMessage },
        { property: 'sessionStorage', message: storageAccessMessage },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: `Literal[value=${STORAGE_KEY_LITERAL}]`, message: storageKeyMessage },
        {
          selector: `TemplateElement[value.raw=${STORAGE_KEY_LITERAL}]`,
          message: storageKeyMessage,
        },
      ],
    },
  },
  {
    files: ['src/storage/kv.ts'],
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },
  { files: ['src/storage/keys.ts'], rules: { 'no-restricted-syntax': 'off' } },
]

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'test-results', 'playwright-report']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite(),
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  ...layerConfigs,
  ...storageConfigs,
  // No interface text in markup: JSX text and user-visible attributes come from the
  // i18n dictionaries (architecture/react-port/i18n.md, "No strings in markup").
  {
    files: ['src/**/*.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          // A template string in JSX (`{`text`}`) is checked like a plain string.
          'should-validate-template': true,
          // Only attributes a user sees or hears are checked; `lang`, `role`, `to` and the like are data.
          'jsx-attributes': {
            include: [
              'alt',
              'aria-label',
              'aria-description',
              'aria-valuetext',
              'placeholder',
              'title',
              'label',
            ],
          },
          words: {
            // The plugin defaults (punctuation, UPPER_CASE, HTML entities, emoji) plus decoration
            // symbols, alone or mixed with emoji ("✓", "→ 🔊").
            exclude: [...i18nextDefaults.words.exclude, /^[\s✓✔→←↑↓·•×\p{Emoji}]+$/u],
          },
          message: 'Interface text must come from the i18n dictionary (src/i18n/locales)',
        },
      ],
    },
  },
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
  },
  // Last: turns off ESLint rules that conflict with Prettier formatting.
  eslintConfigPrettier,
  // Re-enabled after eslint-config-prettier (a "special rule" it allows): with
  // `semi: false` it catches lines that silently join the previous statement.
  // A rare false positive after Prettier: disable for that line or refactor.
  { rules: { 'no-unexpected-multiline': 'error' } },
])
