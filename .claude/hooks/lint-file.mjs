import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { EOL } from 'node:os'
import { isAbsolute, relative, sep } from 'node:path'

const input = JSON.parse(readFileSync(0, 'utf8') || '{}')
const file = input.tool_input?.file_path ?? input.tool_response?.filePath
if (!file || !/[.](ts|tsx|js|jsx|mjs|cjs)$/.test(file)) process.exit(0)

const rel = (isAbsolute(file) ? relative(process.cwd(), file) : file).replaceAll(sep, '/')
if (rel.startsWith('..') || !existsSync(rel)) process.exit(0)

const result = spawnSync('yarn', ['oxlint', rel], { encoding: 'utf8', shell: true })
if (result.status === 0) process.exit(0)

process.stderr.write(`oxlint 가 ${rel} 에서 실패했다. 아래 오류를 고친 뒤 계속한다.${EOL}${result.stdout}${result.stderr}`)
process.exit(2)
