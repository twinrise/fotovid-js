import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

// Single-source the version from package.json into the bundle (used in the
// MCP server's reported version, and consistent with packages/sdk).
const { version } = JSON.parse(
	readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm"],
	dts: false,
	clean: true,
	sourcemap: true,
	target: "es2022",
	banner: { js: "#!/usr/bin/env node" },
	define: { __MCP_VERSION__: JSON.stringify(version) },
});
