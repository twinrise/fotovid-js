import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

// Single-source the version from package.json into the bundle (used in the UA).
const { version } = JSON.parse(
	readFileSync(new URL("./package.json", import.meta.url), "utf8"),
);

export default defineConfig({
	entry: ["src/index.ts"],
	format: ["esm", "cjs"],
	dts: true,
	clean: true,
	sourcemap: true,
	target: "es2022",
	define: { __SDK_VERSION__: JSON.stringify(version) },
});
