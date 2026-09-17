import assert from 'node:assert/strict'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import test from 'node:test'
import { prepare } from './prepare.mjs'

const cases = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'))

const fixture = (context) => {
  const temporaryRoot = realpathSync(tmpdir())
  const directory = mkdtempSync(join(temporaryRoot, 'frontend-harness-'))
  const repoRoot = join(directory, 'repo')
  mkdirSync(join(repoRoot, 'evals/harness'), { recursive: true })
  writeFileSync(join(repoRoot, 'evals/harness/cases.json'), JSON.stringify(cases))
  context.after(() => {
    assert.equal(dirname(directory), temporaryRoot)
    assert.ok(basename(directory).startsWith('frontend-harness-'))
    rmSync(directory, { recursive: true, force: true })
  })
  return { directory, repoRoot }
}

test('전체 사례의 입력을 보존하고 정답과 목적은 출력하지 않는다', (context) => {
  const { repoRoot } = fixture(context)
  const result = prepare({ repoRoot, outputDir: '.harness/blind' })
  assert.equal(result.files.length, 6)
  assert.equal(readdirSync(result.outputDir).length, cases.cases.length)
  for (const entry of cases.cases) {
    const output = JSON.parse(readFileSync(join(result.outputDir, `${entry.id}.json`), 'utf8'))
    assert.deepEqual(output, { caseId: entry.id, input: entry.input })
    assert.ok(entry.expected.criteria.length > 0)
    assert.ok(entry.expected.must.length > 0)
    assert.ok(entry.expected.must_not.length > 0)
  }
})

test('요청한 사례만 생성하며 알 수 없는 ID에서는 출력하지 않는다', (context) => {
  const { repoRoot } = fixture(context)
  const result = prepare({ repoRoot, outputDir: '.harness/selected', caseIds: ['H-04'] })
  assert.deepEqual(readdirSync(result.outputDir), ['H-04.json'])
  assert.throws(
    () => prepare({ repoRoot, outputDir: '.harness/unknown', caseIds: ['missing'] }),
    /알 수 없는 사례/,
  )
  assert.equal(existsSync(join(repoRoot, '.harness/unknown')), false)
})

test('기존 출력 디렉터리와 파일을 보존한다', (context) => {
  const { repoRoot } = fixture(context)
  const existing = join(repoRoot, '.harness/existing')
  mkdirSync(existing, { recursive: true })
  const marker = join(existing, 'keep.txt')
  writeFileSync(marker, 'keep me')
  assert.throws(() => prepare({ repoRoot, outputDir: '.harness/existing' }), /덮어쓰지/)
  assert.equal(readFileSync(marker, 'utf8'), 'keep me')
  assert.deepEqual(readdirSync(existing), ['keep.txt'])
  assert.throws(
    () => prepare({ repoRoot, outputDir: '.harness/existing/keep.txt/run' }),
    /디렉터리/,
  )
})

test('저장소 밖과 .harness 밖 또는 그 루트로 출력하지 않는다', (context) => {
  const { directory, repoRoot } = fixture(context)
  for (const outputDir of [
    '../outside',
    '.harness/../../outside',
    'src/new',
    '.harness',
    join(directory, 'absolute'),
  ]) {
    assert.throws(() => prepare({ repoRoot, outputDir }), /\.harness 아래/)
  }
  assert.equal(existsSync(join(directory, 'outside')), false)
  assert.equal(existsSync(join(directory, 'absolute')), false)
  assert.equal(existsSync(join(repoRoot, 'src')), false)
})

test('심볼릭 링크 또는 Windows junction을 경유하는 출력은 거절한다', (context) => {
  const { directory, repoRoot } = fixture(context)
  const outside = join(directory, 'outside')
  mkdirSync(outside)
  mkdirSync(join(repoRoot, '.harness'))
  symlinkSync(outside, join(repoRoot, '.harness/linked'), 'junction')
  assert.throws(() => prepare({ repoRoot, outputDir: '.harness/linked/run' }), /심볼릭 링크/)
  assert.deepEqual(readdirSync(outside), [])
})
