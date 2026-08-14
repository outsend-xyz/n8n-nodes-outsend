/**
 * Copies node icons (*.svg) from nodes/ into dist/nodes/, preserving the
 * directory structure. Runs as part of `npm run build` (after tsc).
 */
const fs = require('fs');
const path = require('path');

const srcRoot = path.join(__dirname, '..', 'nodes');
const destRoot = path.join(__dirname, '..', 'dist', 'nodes');

function copySvgs(dir, out) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const from = path.join(dir, entry.name);
		const to = path.join(out, entry.name);
		if (entry.isDirectory()) {
			copySvgs(from, to);
		} else if (entry.name.endsWith('.svg')) {
			fs.mkdirSync(out, { recursive: true });
			fs.copyFileSync(from, to);
		}
	}
}

copySvgs(srcRoot, destRoot);
console.log('SVG icons copied to dist/nodes/');
