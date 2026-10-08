import * as esbuild from 'esbuild';
import { existsSync, readdirSync } from 'fs';
import { join, sep } from 'path';

const BUILD_DIRECTORY = 'dist';
const PRODUCTION = process.env.NODE_ENV === 'production';
const LIVE_RELOAD = !PRODUCTION;
const SERVE_PORT = 3000;
const SERVE_ORIGIN = `http://localhost:${SERVE_PORT}`;
const API_ORIGIN = process.env.CAREERS_API_ORIGIN || (PRODUCTION ? 'https://career-group.vercel.app' : 'http://localhost:8787');

function addEntries(entryPoints, dir, keyPrefix, extension) {
	if (!existsSync(dir)) {
		return;
	}

	const files = readdirSync(dir, { withFileTypes: true });
	for (const file of files) {
		if (!file.isFile() || !file.name.endsWith(extension)) {
			continue;
		}

		const name = file.name.slice(0, -extension.length);
		const key = keyPrefix ? `${keyPrefix}/${name}` : name;
		entryPoints[key] = join(dir, file.name);
	}
}

function getPageEntryPoints() {
	const entryPoints = {};
	addEntries(entryPoints, 'pages', 'pages', '.ts');
	addEntries(entryPoints, 'shared', '', '.css');
	return entryPoints;
}

const PAGE_ENTRY_POINTS = getPageEntryPoints();

const context = await esbuild.context({
	bundle: true,
	entryPoints: PAGE_ENTRY_POINTS,
	outdir: BUILD_DIRECTORY,
	outbase: '.',
	minify: PRODUCTION,
	sourcemap: !PRODUCTION,
	target: PRODUCTION ? 'es2020' : 'esnext',
	format: 'esm',
	inject: LIVE_RELOAD ? ['./bin/live-reload.js'] : undefined,
	define: {
		SERVE_ORIGIN: JSON.stringify(SERVE_ORIGIN),
		API_ORIGIN: JSON.stringify(API_ORIGIN),
	},
});

if (PRODUCTION) {
	await context.rebuild();
	context.dispose();
} else {
	await context.watch();
	await context
		.serve({
			servedir: BUILD_DIRECTORY,
			port: SERVE_PORT,
			cors: { origin: '*' },
		})
		.then(logServedFiles);
}

function logServedFiles() {
	const getFiles = (dirPath) => {
		const files = readdirSync(dirPath, { withFileTypes: true }).map((dirent) => {
			const path = join(dirPath, dirent.name);
			return dirent.isDirectory() ? getFiles(path) : path;
		});

		return files.flat();
	};

	const files = getFiles(BUILD_DIRECTORY);
	const filesInfo = files
		.map((file) => {
			if (file.endsWith('.map')) {
				return;
			}

			const paths = file.split(sep);
			paths[0] = SERVE_ORIGIN;
			const location = paths.join('/');
			const tag = file.endsWith('.css')
				? `<link rel="stylesheet" href="${location}">`
				: `<script type="module" src="${location}"></script>`;

			return {
				'File Location': location,
				'Import Suggestion': tag,
			};
		})
		.filter(Boolean);

	console.table(filesInfo);
}
