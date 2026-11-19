import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
const displayAttribute =
  /^(title|label|help|text|alt|placeholder|aria-label|aria-description|postfix|prefix|disclaimer|.*(?:Text|Label|Placeholder|Message|Title))$/
const failures = []
// Protocol names and standard abbreviations are intentionally language independent.
const identifiers = new Set([
  'URL',
  'S3',
  'IPFS',
  'Arweave',
  'FTP/FTPS',
  'EDC',
  'REA',
  'SaaS',
  'N/A'
])
function displayLiterals(node) {
  if (!node) return []
  if (ts.isStringLiteral(node))
    return /[a-zA-Z]/.test(node.text) && !identifiers.has(node.text)
      ? [node]
      : []
  if (ts.isConditionalExpression(node))
    return [
      ...displayLiterals(node.whenTrue),
      ...displayLiterals(node.whenFalse)
    ]
  if (ts.isParenthesizedExpression(node))
    return displayLiterals(node.expression)
  if (
    ts.isBinaryExpression(node) &&
    [
      ts.SyntaxKind.BarBarToken,
      ts.SyntaxKind.QuestionQuestionToken,
      ts.SyntaxKind.AmpersandAmpersandToken
    ].includes(node.operatorToken.kind)
  )
    return displayLiterals(node.right)
  return []
}
function walk(dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, item.name)
    if (item.isDirectory()) {
      if (!['locales', '@types'].includes(item.name)) walk(file)
    } else if (file.endsWith('.tsx') && !/\.(test|spec)\./.test(file)) {
      const text = fs.readFileSync(file, 'utf8')
      const ast = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      )
      function visit(node) {
        if (
          ts.isJsxElement(node) &&
          (['Trans', 'style'].includes(
            node.openingElement.tagName.getText(ast)
          ) ||
            node.openingElement.attributes.properties.some(
              (p) => ts.isJsxAttribute(p) && p.name.text === 'lang'
            ))
        )
          return
        const rawText = ts.isJsxText(node) && /[a-zA-Z]/.test(node.text)
        const rawAttribute =
          ts.isJsxAttribute(node) &&
          displayAttribute.test(node.name.text) &&
          node.initializer &&
          ts.isStringLiteral(node.initializer) &&
          /[a-zA-Z]/.test(node.initializer.text) &&
          !/^(https?:|did:|\/|0x)/.test(node.initializer.text)
        if (ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent)) {
          for (const literal of displayLiterals(node.expression))
            failures.push(
              `${file}:${
                ast.getLineAndCharacterOfPosition(literal.getStart(ast)).line +
                1
              }: ${literal.getText(ast)}`
            )
        }
        if (rawText || rawAttribute)
          failures.push(
            `${file}:${
              ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1
            }: ${node.getText(ast).trim()}`
          )
        ts.forEachChild(node, visit)
      }
      visit(ast)
    }
  }
}
walk('src')
if (failures.length) {
  console.error('Untranslated interface text:\n' + failures.join('\n'))
  process.exitCode = 1
} else
  console.log(
    'No untranslated JSX text, display expressions, or display attributes.'
  )
