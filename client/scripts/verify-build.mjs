import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const distAssets = join(process.cwd(), 'dist', 'assets')
const files = await readdir(distAssets)
const cssFiles = files.filter((name) => name.endsWith('.css'))
if (!cssFiles.length) {
  console.error('verify-build: no CSS files in dist/assets')
  process.exit(1)
}

const css = await readFile(join(distAssets, cssFiles[0]), 'utf8')
if (!css.includes('.auth-page')) {
  console.error('verify-build: dist CSS missing .auth-page rules')
  process.exit(1)
}

console.log(`verify-build: ok (${cssFiles[0]})`)
