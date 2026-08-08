import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    // Nested repositories have their own lint/build configuration and may
    // contain generated Vite/Expo output that must never be linted by root.
    "CoinCall/**",
    "expo-app/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
