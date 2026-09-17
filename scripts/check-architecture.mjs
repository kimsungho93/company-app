import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const layers = ['app', 'pages', 'widgets', 'features', 'shared']
const canonicalPath = (file) => (ts.sys.useCaseSensitiveFileNames ? file : file.toLowerCase())
const relativePath = (root, file) => path.relative(root, file).split(path.sep).join('/')
const isSourceFile = (file) => /\.(?:tsx?|mts|cts)$/.test(file) && !/\.d\.[^./\\]+\.ts$/.test(file)

const boundaryViolation = (source, target) => {
  const [sourceLayer, sourceFeature] = source.split('/')
  const [targetLayer, targetFeature, ...targetPath] = target.split('/')
  const sourceRank = layers.indexOf(sourceLayer)
  const targetRank = layers.indexOf(targetLayer)

  if (sourceRank !== -1 && targetRank !== -1 && sourceRank > targetRank) {
    return `${sourceLayer} cannot depend on the higher layer ${targetLayer}`
  }
  if (sourceLayer === 'features' && targetLayer === 'features' && sourceFeature !== targetFeature) {
    return `feature ${sourceFeature} cannot depend directly on feature ${targetFeature}; compose them in widgets or pages`
  }
  if (
    targetLayer === 'features' &&
    (sourceLayer !== 'features' || sourceFeature !== targetFeature) &&
    targetPath.join('/') !== 'index.ts'
  ) {
    return `feature ${targetFeature} must be accessed through its public index.ts`
  }
  return undefined
}

const moduleSpecifier = (node) => {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return node.moduleSpecifier
  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) return node.argument.literal
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
    return node.moduleReference.expression
  }
  if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
    return node.arguments[0]
  }
  return undefined
}

export const checkArchitecture = (root = process.cwd()) => {
  root = path.resolve(root)
  const configPath = path.join(root, 'tsconfig.app.json')
  const config = ts.readConfigFile(configPath, ts.sys.readFile)
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'))
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, undefined, configPath)
  if (parsed.errors.length) {
    throw new Error(
      parsed.errors
        .map((error) => ts.flattenDiagnosticMessageText(error.messageText, '\n'))
        .join('\n'),
    )
  }
  const srcRoot = canonicalPath(path.join(root, 'src'))
  const cache = ts.createModuleResolutionCache(root, canonicalPath, parsed.options)
  const violations = []

  for (const file of parsed.fileNames.filter(isSourceFile).sort()) {
    const source = relativePath(srcRoot, canonicalPath(path.resolve(file)))
    if (source.startsWith('../') || path.isAbsolute(source)) continue
    const text = ts.sys.readFile(file)
    if (text === undefined) throw new Error(`Cannot read ${relativePath(root, file)}`)
    if (!/\b(?:import|export)\b/.test(text)) continue
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true)
    const visit = (node) => {
      const specifier = moduleSpecifier(node)
      if (specifier && ts.isStringLiteralLike(specifier)) {
        const resolved = ts.resolveModuleName(
          specifier.text,
          file,
          parsed.options,
          ts.sys,
          cache,
        ).resolvedModule
        if (
          resolved &&
          !resolved.isExternalLibraryImport &&
          isSourceFile(resolved.resolvedFileName)
        ) {
          const target = relativePath(
            srcRoot,
            canonicalPath(path.resolve(resolved.resolvedFileName)),
          )
          if (!target.startsWith('../') && !path.isAbsolute(target)) {
            const reason = boundaryViolation(source, target)
            if (reason) {
              const position = sourceFile.getLineAndCharacterOfPosition(
                specifier.getStart(sourceFile),
              )
              violations.push({
                file: relativePath(root, file),
                line: position.line + 1,
                column: position.character + 1,
                specifier: specifier.text,
                target: `src/${target}`,
                reason,
              })
            }
          }
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
  }
  return violations
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const violations = checkArchitecture()
    for (const violation of violations) {
      console.error(
        `${violation.file}:${violation.line}:${violation.column}: ${violation.reason} (${violation.specifier} -> ${violation.target})`,
      )
    }
    if (violations.length) {
      console.error(`Architecture check failed: ${violations.length} violation(s).`)
      process.exitCode = 1
    } else {
      console.log('Architecture check passed.')
    }
  } catch (error) {
    console.error(`Architecture check failed: ${error.message}`)
    process.exitCode = 1
  }
}
