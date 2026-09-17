import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { checkArchitecture } from './check-architecture.mjs'

const fixture = (t, files) => {
  const root = mkdtempSync(path.join(tmpdir(), 'company-architecture-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  const contents = {
    'tsconfig.app.json': JSON.stringify({
      compilerOptions: {
        module: 'esnext',
        moduleResolution: 'bundler',
        jsx: 'react-jsx',
        allowArbitraryExtensions: true,
        paths: { '@/*': ['./src/*'], '#auth': ['./src/features/auth/internal.ts'] },
      },
      include: ['src'],
    }),
    'src/app/entry.ts': 'export const value = 1',
    'src/pages/page.ts': 'export const value = 1',
    'src/widgets/widget.ts': 'export const value = 1',
    'src/features/auth/index.ts': "export { value } from './internal'",
    'src/features/auth/internal.ts': 'export const value = 1; export type Value = number',
    'src/features/leave/index.ts': 'export const value = 1',
    'src/shared/util.ts': 'export const value = 1',
    ...files,
  }
  for (const [file, text] of Object.entries(contents)) {
    const destination = path.join(root, file)
    mkdirSync(path.dirname(destination), { recursive: true })
    writeFileSync(destination, text)
  }
  return root
}

test('permits downward dependencies, public entries and imports within the same feature', (t) => {
  const root = fixture(t, {
    'src/app/entry.ts': "import '@/pages/page'",
    'src/pages/page.ts':
      "import '../widgets/widget'; export { value } from '@/features/auth/index.ts'",
    'src/widgets/widget.ts': "import '@/features/auth'; import '../features/leave/index'",
    'src/features/auth/internal.ts': "import '@/shared/util'; export const value = 1",
    'src/features/auth/model/useAuth.ts': "import '../internal'; import '@/features/auth/internal'",
    'src/test/helper.ts': "import '../features/auth'",
  })
  assert.deepEqual(checkArchitecture(root), [])
})

test('rejects every upward layer dependency through aliases and relative paths', (t) => {
  const layerFiles = [
    'app/entry.ts',
    'pages/page.ts',
    'widgets/widget.ts',
    'features/auth/index.ts',
    'shared/util.ts',
  ]
  for (let sourceRank = 1; sourceRank < layerFiles.length; sourceRank += 1) {
    for (let targetRank = 0; targetRank < sourceRank; targetRank += 1) {
      const source = layerFiles[sourceRank]
      const target = layerFiles[targetRank]
      const relative = path.posix.relative(path.posix.dirname(source), target)
      for (const specifier of [
        `@/${target}`,
        relative.startsWith('.') ? relative : `./${relative}`,
      ]) {
        const root = fixture(t, { [`src/${source}`]: `import '${specifier}'` })
        const violations = checkArchitecture(root)
        assert.equal(violations.length, 1, `${source} -> ${specifier}`)
        assert.match(violations[0].reason, /higher layer/)
        assert.equal(violations[0].target, `src/${target}`)
      }
    }
  }
})

test('rejects direct feature dependencies including another feature public entry', (t) => {
  for (const specifier of ['@/features/leave', '../leave/index.ts']) {
    const root = fixture(t, { 'src/features/auth/consumer.ts': `import '${specifier}'` })
    const violations = checkArchitecture(root)
    assert.equal(violations.length, 1)
    assert.match(violations[0].reason, /feature auth cannot depend directly on feature leave/)
  }
})

test('requires the feature public index for aliases, relative paths and custom aliases', (t) => {
  for (const specifier of ['@/features/auth/internal', '../features/auth/internal', '#auth']) {
    const root = fixture(t, { 'src/pages/page.ts': `import '${specifier}'` })
    const violations = checkArchitecture(root)
    assert.equal(violations.length, 1)
    assert.match(violations[0].reason, /public index\.ts/)
  }
  const root = fixture(t, { 'src/test/helper.ts': "import '../features/auth/internal'" })
  assert.match(checkArchitecture(root)[0].reason, /public index\.ts/)
})

test('checks re-exports, type references and literal dynamic imports', (t) => {
  const declarations = [
    "export { value } from '@/features/auth/internal'",
    "export * from '../features/auth/internal'",
    "import type { Value } from '@/features/auth/internal'",
    "export type { Value } from '../features/auth/internal'",
    "type Value = import('@/features/auth/internal').Value",
    "const value = import('../features/auth/internal')",
    'const value = import(`@/features/auth/internal`)',
    "import value = require('../features/auth/internal')",
  ]
  for (const declaration of declarations) {
    const root = fixture(t, { 'src/pages/page.ts': `\n${declaration}` })
    const violations = checkArchitecture(root)
    assert.equal(violations.length, 1, declaration)
    assert.equal(violations[0].file, 'src/pages/page.ts')
    assert.equal(violations[0].line, 2)
    assert.match(violations[0].reason, /public index\.ts/)
  }
})

test('ignores external packages, unresolved modules, assets and text that is not an import', (t) => {
  const root = fixture(t, {
    'node_modules/example/package.json': JSON.stringify({ name: 'example', types: 'index.d.ts' }),
    'node_modules/example/index.d.ts': 'export declare const value: number',
    'src/shared/util.ts': [
      "import { value } from 'example'",
      "import '@/features/missing'",
      "import '@/features/auth/style.scss'",
      "import '@/features/auth/icon.svg'",
      'const text = "import \'@/features/auth/internal\'"',
      "const moduleName = '@/features/auth/internal'",
      'void import(moduleName)',
    ].join('\n'),
    'src/features/auth/style.scss': '.root { color: red; }',
    'src/features/auth/style.d.scss.ts':
      'declare const styles: Record<string, string>; export default styles',
    'src/features/auth/icon.svg': '<svg />',
  })
  assert.deepEqual(checkArchitecture(root), [])
})

test('CLI reports file, line and reason and returns a nonzero exit status', (t) => {
  const root = fixture(t, { 'src/shared/util.ts': "\nimport '@/features/auth'" })
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('./check-architecture.mjs', import.meta.url))],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )
  assert.equal(result.status, 1)
  assert.match(
    result.stderr,
    /src\/shared\/util\.ts:2:\d+: shared cannot depend on the higher layer features/,
  )
  assert.match(result.stderr, /Architecture check failed: 1 violation/)
})
