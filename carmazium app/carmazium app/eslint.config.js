// Minimal ESLint setup — this project has no other lint tooling (see CLAUDE.md:
// `npx tsc --noEmit` was previously the only automated gate). The one rule wired
// up here enforces the design-token system added in the UI/UX audit's Stage 2:
// no raw hex/rgba color literals or hardcoded numeric fontSize values outside
// the token definition files themselves.
const restrictedColorLiteral = {
  selector: "Literal[value=/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/]",
  message: 'Raw hex colors are not allowed — add/use a token in src/constants/colors.ts instead.',
};
// rgba() alpha-scale tokens landed 2026-07-11 (src/constants/colors.ts
// *Alpha* entries) for every (base color, opacity) pair that appeared 3+
// times verbatim in src/. This rule only flags literals matching one of
// those now-tokenized values — a regression guard against copy-pasting the
// old raw form instead of the token. It deliberately does NOT ban rgba()
// outright: ~155 occurrences across ~120 distinct one-off opacities remain
// as inline literals by design (minting a token for a value used once isn't
// worth it), and rgba(...,0) gradient stops are never flagged since an
// alpha-0 token would lose the RGB channels gradients interpolate through.
// Regenerate the alternation with scratchpad's gen_rgba_lint_regex.js
// (reads src/constants/colors.ts) if the token set changes.
const restrictedRgbaLiteral = {
  selector: "Literal[value=/^(?:rgba\\(255,\\s*255,\\s*255,\\s*0\\.07\\)|rgba\\(255,\\s*255,\\s*255,\\s*0\\.08\\)|rgba\\(255,\\s*255,\\s*255,\\s*0\\.09\\)|rgba\\(220,\\s*31,\\s*38,\\s*0\\.10\\)|rgba\\(220,\\s*31,\\s*38,\\s*0\\.1\\)|rgba\\(220,\\s*31,\\s*38,\\s*0\\.14\\)|rgba\\(255,\\s*255,\\s*255,\\s*0\\.02\\)|rgba\\(255,\\s*255,\\s*255,\\s*0\\.03\\)|rgba\\(255,\\s*255,\\s*255,\\s*0\\.04\\)|rgba\\(255,\\s*255,\\s*255,\\s*0\\.05\\)|rgba\\(255,\\s*255,\\s*255,\\s*0\\.06\\)|rgba\\(255,\\s*255,\\s*255,\\s*0\\.10\\)|rgba\\(255,\\s*255,\\s*255,\\s*0\\.1\\)|rgba\\(255,\\s*255,\\s*255,\\s*0\\.12\\)|rgba\\(255,\\s*255,\\s*255,\\s*0\\.15\\)|rgba\\(255,\\s*255,\\s*255,\\s*0\\.20\\)|rgba\\(255,\\s*255,\\s*255,\\s*0\\.2\\)|rgba\\(255,\\s*255,\\s*255,\\s*0\\.50\\)|rgba\\(255,\\s*255,\\s*255,\\s*0\\.5\\)|rgba\\(220,\\s*31,\\s*38,\\s*0\\.03\\)|rgba\\(220,\\s*31,\\s*38,\\s*0\\.04\\)|rgba\\(220,\\s*31,\\s*38,\\s*0\\.05\\)|rgba\\(220,\\s*31,\\s*38,\\s*0\\.06\\)|rgba\\(220,\\s*31,\\s*38,\\s*0\\.08\\)|rgba\\(220,\\s*31,\\s*38,\\s*0\\.12\\)|rgba\\(220,\\s*31,\\s*38,\\s*0\\.15\\)|rgba\\(220,\\s*31,\\s*38,\\s*0\\.20\\)|rgba\\(220,\\s*31,\\s*38,\\s*0\\.2\\)|rgba\\(220,\\s*31,\\s*38,\\s*0\\.22\\)|rgba\\(220,\\s*31,\\s*38,\\s*0\\.25\\)|rgba\\(220,\\s*31,\\s*38,\\s*0\\.30\\)|rgba\\(220,\\s*31,\\s*38,\\s*0\\.3\\)|rgba\\(220,\\s*31,\\s*38,\\s*0\\.40\\)|rgba\\(220,\\s*31,\\s*38,\\s*0\\.4\\)|rgba\\(245,\\s*158,\\s*11,\\s*0\\.05\\)|rgba\\(245,\\s*158,\\s*11,\\s*0\\.06\\)|rgba\\(245,\\s*158,\\s*11,\\s*0\\.08\\)|rgba\\(245,\\s*158,\\s*11,\\s*0\\.10\\)|rgba\\(245,\\s*158,\\s*11,\\s*0\\.1\\)|rgba\\(245,\\s*158,\\s*11,\\s*0\\.12\\)|rgba\\(245,\\s*158,\\s*11,\\s*0\\.14\\)|rgba\\(245,\\s*158,\\s*11,\\s*0\\.15\\)|rgba\\(245,\\s*158,\\s*11,\\s*0\\.20\\)|rgba\\(245,\\s*158,\\s*11,\\s*0\\.2\\)|rgba\\(245,\\s*158,\\s*11,\\s*0\\.25\\)|rgba\\(245,\\s*158,\\s*11,\\s*0\\.30\\)|rgba\\(245,\\s*158,\\s*11,\\s*0\\.3\\)|rgba\\(59,\\s*130,\\s*246,\\s*0\\.03\\)|rgba\\(59,\\s*130,\\s*246,\\s*0\\.04\\)|rgba\\(59,\\s*130,\\s*246,\\s*0\\.06\\)|rgba\\(59,\\s*130,\\s*246,\\s*0\\.08\\)|rgba\\(59,\\s*130,\\s*246,\\s*0\\.10\\)|rgba\\(59,\\s*130,\\s*246,\\s*0\\.1\\)|rgba\\(59,\\s*130,\\s*246,\\s*0\\.12\\)|rgba\\(59,\\s*130,\\s*246,\\s*0\\.14\\)|rgba\\(59,\\s*130,\\s*246,\\s*0\\.15\\)|rgba\\(59,\\s*130,\\s*246,\\s*0\\.20\\)|rgba\\(59,\\s*130,\\s*246,\\s*0\\.2\\)|rgba\\(59,\\s*130,\\s*246,\\s*0\\.25\\)|rgba\\(59,\\s*130,\\s*246,\\s*0\\.28\\)|rgba\\(59,\\s*130,\\s*246,\\s*0\\.30\\)|rgba\\(59,\\s*130,\\s*246,\\s*0\\.3\\)|rgba\\(34,\\s*197,\\s*94,\\s*0\\.06\\)|rgba\\(34,\\s*197,\\s*94,\\s*0\\.08\\)|rgba\\(34,\\s*197,\\s*94,\\s*0\\.10\\)|rgba\\(34,\\s*197,\\s*94,\\s*0\\.1\\)|rgba\\(34,\\s*197,\\s*94,\\s*0\\.12\\)|rgba\\(34,\\s*197,\\s*94,\\s*0\\.14\\)|rgba\\(34,\\s*197,\\s*94,\\s*0\\.15\\)|rgba\\(34,\\s*197,\\s*94,\\s*0\\.20\\)|rgba\\(34,\\s*197,\\s*94,\\s*0\\.2\\)|rgba\\(34,\\s*197,\\s*94,\\s*0\\.25\\)|rgba\\(16,\\s*185,\\s*129,\\s*0\\.05\\)|rgba\\(16,\\s*185,\\s*129,\\s*0\\.06\\)|rgba\\(16,\\s*185,\\s*129,\\s*0\\.08\\)|rgba\\(16,\\s*185,\\s*129,\\s*0\\.12\\)|rgba\\(16,\\s*185,\\s*129,\\s*0\\.15\\)|rgba\\(16,\\s*185,\\s*129,\\s*0\\.20\\)|rgba\\(16,\\s*185,\\s*129,\\s*0\\.2\\)|rgba\\(16,\\s*185,\\s*129,\\s*0\\.30\\)|rgba\\(16,\\s*185,\\s*129,\\s*0\\.3\\)|rgba\\(239,\\s*68,\\s*68,\\s*0\\.08\\)|rgba\\(239,\\s*68,\\s*68,\\s*0\\.10\\)|rgba\\(239,\\s*68,\\s*68,\\s*0\\.1\\)|rgba\\(239,\\s*68,\\s*68,\\s*0\\.14\\)|rgba\\(239,\\s*68,\\s*68,\\s*0\\.20\\)|rgba\\(239,\\s*68,\\s*68,\\s*0\\.2\\)|rgba\\(239,\\s*68,\\s*68,\\s*0\\.25\\)|rgba\\(239,\\s*68,\\s*68,\\s*0\\.30\\)|rgba\\(239,\\s*68,\\s*68,\\s*0\\.3\\)|rgba\\(0,\\s*0,\\s*0,\\s*0\\.45\\)|rgba\\(0,\\s*0,\\s*0,\\s*0\\.50\\)|rgba\\(0,\\s*0,\\s*0,\\s*0\\.5\\)|rgba\\(0,\\s*0,\\s*0,\\s*0\\.55\\)|rgba\\(0,\\s*0,\\s*0,\\s*0\\.75\\)|rgba\\(160,\\s*160,\\s*171,\\s*0\\.20\\)|rgba\\(160,\\s*160,\\s*171,\\s*0\\.2\\))$/]",
  message: 'This exact rgba(...) value already has a Colors.*Alpha* token — use it instead of the raw literal.',
};
const restrictedFontSize = {
  selector: "Property[key.name='fontSize'][value.raw=/^[0-9]/]",
  message: 'Hardcoded fontSize is not allowed — add/use a token in src/constants/typography.ts instead.',
};

const tsParser = require('@typescript-eslint/parser');
const reactHooksPlugin = require('eslint-plugin-react-hooks');

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      '.expo/**',
      'src/constants/colors.ts',
      'src/constants/typography.ts',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      'no-restricted-syntax': [
        'error',
        restrictedColorLiteral,
        restrictedRgbaLiteral,
        restrictedFontSize,
      ],
    },
  },
];
