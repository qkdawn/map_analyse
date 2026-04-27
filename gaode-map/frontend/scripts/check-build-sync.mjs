import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const srcDir = path.join(rootDir, 'src')
const assetDir = path.resolve(rootDir, '..', 'static', 'frontend', 'assets')

function walkFiles(dir, collector = []) {
  if (!fs.existsSync(dir)) return collector
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkFiles(absolutePath, collector)
      continue
    }
    collector.push(absolutePath)
  }
  return collector
}

function latestMtime(files = []) {
  let latest = 0
  for (const filePath of files) {
    const stat = fs.statSync(filePath)
    latest = Math.max(latest, Number(stat.mtimeMs || 0))
  }
  return latest
}

const srcFiles = walkFiles(srcDir).filter((filePath) => /\.(js|ts|vue|html|css)$/i.test(filePath))
if (!srcFiles.length) {
  console.log('[check:build-sync] no frontend source files found, skip')
  process.exit(0)
}

const assetFiles = walkFiles(assetDir).filter((filePath) => /\.(js|css)$/i.test(filePath))
if (!assetFiles.length) {
  console.error('[check:build-sync] static/frontend/assets is empty, please run `npm run build`')
  process.exit(1)
}

const latestSrcMtime = latestMtime(srcFiles)
const latestAssetMtime = latestMtime(assetFiles)
if (latestSrcMtime > latestAssetMtime) {
  console.error('[check:build-sync] frontend/src is newer than static assets, please rebuild with `npm run build`')
  process.exit(1)
}

console.log('[check:build-sync] build assets are in sync')
