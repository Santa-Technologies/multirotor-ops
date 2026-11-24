import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // The pricing engine is pure: no database, framework, network or Node APIs.
    files: ["lib/pricing/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/*", "../*"],
              message: "lib/pricing may only import its own modules.",
            },
            {
              group: ["node:*", "fs", "path", "http", "https", "crypto"],
              message: "No I/O in lib/pricing.",
            },
            {
              group: [
                "next",
                "next/*",
                "react",
                "server-only",
                "postgres",
                "drizzle-orm",
                "drizzle-orm/*",
                "@supabase/*",
              ],
              message: "No I/O in lib/pricing.",
            },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "drizzle/meta/**"]),
]);

export default eslintConfig;
