import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { EOL } from 'node:os'

readFileSync(0, 'utf8')

const NL = String.fromCharCode(10)
const run = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8', shell: true })
const tail = (text, lines = 60) => text.trim().split(NL).slice(-lines).join(NL)

const changed = run('git', ['status', '--porcelain', '--', '*.ts', '*.tsx'])
if (changed.status !== 0 || !changed.stdout.trim()) process.exit(0)

const steps = [
  ['yarn', ['tsc', '-b']],
  ['yarn', ['vitest', 'run', '--changed', '--passWithNoTests']],
]
for (const [cmd, args] of steps) {
  const result = run(cmd, args)
  if (result.status !== 0) {
    process.stderr.write(`${cmd} ${args.join(' ')} 가 실패했다. 커밋되지 않은 ts/tsx 변경이 있어 턴을 끝내기 전에 검사했다. 고친 뒤 다시 끝낸다.${EOL}${tail(result.stdout + result.stderr)}`)
    process.exit(2)
  }
}
process.exit(0)
