/**
 * Copies icons (*.svg) from nodes/ and credentials/ into dist/, preserving the
 * directory structure. Runs as part of `npm run build` (after tsc).
 *
 * The credential carries an icon too: n8n resolves `file:` icons relative to
 * the compiled file, so the svg has to land next to the .js in dist/.
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
copySvgs(path.join(__dirname, '..', 'credentials'), path.join(__dirname, '..', 'dist', 'credentials'));
console.log('SVG icons copied to dist/nodes/ and dist/credentials/');
