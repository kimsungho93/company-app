import { lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultRoot = fileURLToPath(new URL('../../', import.meta.url))

const isDescendant = (parent, child) => {
  const path = relative(parent, child)
  return path !== '' && path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path)
}

const readCases = (repoRoot) => {
  const data = JSON.parse(readFileSync(resolve(repoRoot, 'evals/harness/cases.json'), 'utf8'))
  if (data.schemaVersion !== 1 || !Array.isArray(data.cases) || data.cases.length === 0) {
    throw new Error('사례 파일의 schemaVersion 또는 cases 배열이 올바르지 않습니다.')
  }
  const ids = new Set()
  for (const entry of data.cases) {
    if (
      typeof entry.id !== 'string' ||
      !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(entry.id) ||
      ids.has(entry.id) ||
      !entry.input ||
      typeof entry.input !== 'object' ||
      Array.isArray(entry.input)
    ) {
      throw new Error('사례 ID는 고유한 파일명이어야 하며 각 사례에 input 객체가 필요합니다.')
    }
    ids.add(entry.id)
  }
  return data.cases
}

const assertSafeOutput = (repoRoot, outputDir) => {
  const harnessRoot = resolve(repoRoot, '.harness')
  const output = resolve(repoRoot, outputDir)
  if (!isDescendant(harnessRoot, output)) {
    throw new Error('출력은 저장소의 .harness 아래 새 디렉터리여야 합니다.')
  }
  let current = repoRoot
  for (const part of relative(repoRoot, output).split(sep)) {
    current = resolve(current, part)
    let info
    try {
      info = lstatSync(current)
    } catch (error) {
      if (error.code === 'ENOENT') continue
      throw error
    }
    if (info.isSymbolicLink() || !info.isDirectory()) {
      throw new Error('출력 경로에 심볼릭 링크나 디렉터리가 아닌 항목을 사용할 수 없습니다.')
    }
    if (current === output) throw new Error('기존 출력 디렉터리를 덮어쓰지 않습니다.')
  }
  return output
}

export const prepare = ({ repoRoot = defaultRoot, outputDir, caseIds = [] }) => {
  if (typeof outputDir !== 'string' || outputDir.length === 0) {
    throw new Error('--out .harness/<새 디렉터리>를 지정하세요.')
  }
  const root = realpathSync(repoRoot)
  const entries = readCases(root)
  const requested = new Set(caseIds)
  for (const id of requested) {
    if (!entries.some((entry) => entry.id === id)) throw new Error(`알 수 없는 사례 ID: ${id}`)
  }
  const selected = entries.filter((entry) => requested.size === 0 || requested.has(entry.id))
  const output = assertSafeOutput(root, outputDir)
  mkdirSync(dirname(output), { recursive: true })
  mkdirSync(output)
  const files = selected.map(({ id, input }) => {
    const file = resolve(output, `${id}.json`)
    writeFileSync(file, `${JSON.stringify({ caseId: id, input }, null, 2)}\n`, { flag: 'wx' })
    return file
  })
  return { outputDir: output, files }
}

const parseArgs = (args) => {
  let outputDir
  const caseIds = []
  for (let index = 0; index < args.length; index += 1) {
    const flag = args[index]
    const value = args[index + 1]
    if ((flag !== '--out' && flag !== '--case') || !value || value.startsWith('--')) {
      throw new Error(
        '사용법: node evals/harness/prepare.mjs --out .harness/<새 디렉터리> [--case H-01]',
      )
    }
    if (flag === '--out') {
      if (outputDir !== undefined) throw new Error('--out은 한 번만 지정하세요.')
      outputDir = value
    } else {
      caseIds.push(value)
    }
    index += 1
  }
  return { outputDir, caseIds }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = prepare(parseArgs(process.argv.slice(2)))
    process.stdout.write(`${result.files.length}개 입력을 ${result.outputDir}에 생성했습니다.\n`)
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}
