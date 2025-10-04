/* Build script: creates dist/ with minified assets and only necessary files.
 * - Minify index.html
 * - Minify JS files (app.js, forms.js, report.js, users.js, data-portability.js)
 * - Copy JSON data, icons, manifest, sw.js as-is (sw.js can be minified later if needed)
 */
const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const { minify: minifyHtml } = require('html-minifier-terser');
const terser = require('terser');

const root = __dirname;
const dist = path.join(root, 'dist');

const ensureDir = async (p) => fse.mkdirp(p);

const read = (p) => fs.readFileSync(p, 'utf8');
const write = (p, c) => fs.writeFileSync(p, c);

async function minifyJSFile(srcPath, destPath) {
  const code = read(srcPath);
  const result = await terser.minify(code, {
    compress: { passes: 2, pure_getters: true, unsafe: true },
    mangle: true,
    sourceMap: false
  });
  if (result.error) throw result.error;
  write(destPath, result.code);
}

async function minifyHTMLFile(srcPath, destPath) {
  const html = read(srcPath);
  const result = await minifyHtml(html, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeEmptyAttributes: true,
    minifyCSS: true,
    minifyJS: true
  });
  write(destPath, result);
}

async function copyStatic(src, dest) {
  await fse.copy(src, dest, {
    overwrite: true,
    filter: (s) => {
      const base = path.basename(s);
      if (base === '.DS_Store' || base === 'Thumbs.db') return false;
      return true;
    }
  });
}

async function main() {
  // Clean dist
  await fse.remove(dist);
  await ensureDir(dist);

  // Minify HTML
  await minifyHTMLFile(path.join(root, 'index.html'), path.join(dist, 'index.html'));

  // Minify core JS files if present
  const jsFiles = ['app.js','forms.js','analytics.js','users.js','data-portability.js','sw.js']; // analytics.js replaces report.js
  for (const jf of jsFiles) {
    const src = path.join(root, jf);
    if (fs.existsSync(src)) {
      const dest = path.join(dist, jf);
      if (jf === 'sw.js') {
        // Keep sw.js readable (minification can affect debugging); still compress lightly
        await minifyJSFile(src, dest);
      } else {
        await minifyJSFile(src, dest);
      }
    }
  }

  // Copy JSON data
  const jsonFiles = ['manifest.json','cso.json'];
  for (const jf of jsonFiles) {
    const src = path.join(root, jf);
    if (fs.existsSync(src)) {
      await copyStatic(src, path.join(dist, jf));
    }
  }

  // Copy icons
  const icons = ['icon-192.png','icon-512.png', 'equip.png'];
  for (const ic of icons) {
    const src = path.join(root, ic);
    if (fs.existsSync(src)) {
      await copyStatic(src, path.join(dist, ic));
    }
  }

  // Copy facilities folder (exclude anything in archive)
  const facilitiesSrc = path.join(root, 'facilities');
  if (fs.existsSync(facilitiesSrc)) {
    await copyStatic(facilitiesSrc, path.join(dist, 'facilities'));
  }

  console.log('Build complete → dist/');
}

main().catch(err => { console.error(err); process.exit(1); });
