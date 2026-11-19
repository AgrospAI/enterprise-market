// Extract display copy whose source value must remain stable for form/API logic.
import fs from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import prettier from 'prettier'
const messages = new Set()
const human = (value) =>
  /[a-zA-Z]/.test(value) &&
  (/\s/.test(value) ||
    /^[A-Z][a-z]+$/.test(value) ||
    /^[A-Z]{1,8}$/.test(value)) &&
  !/^(https?:|\/|did:|urn:|0x|function |Bearer |Basic |cubic-bezier\()/.test(
    value
  ) &&
  !/[{}]/.test(value)
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!['i18n', 'locales', '@types'].includes(entry.name)) walk(file)
    } else if (/\.tsx?$/.test(file) && !/\.(test|spec|d)\./.test(file)) {
      const text = fs.readFileSync(file, 'utf8')
      const ast = ts.createSourceFile(
        file,
        text,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
      )
      function visit(node) {
        if (
          ts.isPropertyAssignment(node) &&
          /^(error|message)$/.test(node.name.getText(ast)) &&
          ts.isStringLiteral(node.initializer) &&
          human(node.initializer.text)
        )
          messages.add(node.initializer.text)
        if (
          ts.isTemplateExpression(node) &&
          (ts.isNewExpression(node.parent) ||
            (ts.isPropertyAssignment(node.parent) &&
              /^(error|message)$/.test(node.parent.name.getText(ast))))
        ) {
          let id = node.head.text
          node.templateSpans.forEach((span, index) => {
            id += '{value' + index + '}' + span.literal.text
          })
          messages.add(id)
        }
        if (
          ts.isVariableDeclaration(node) &&
          node.initializer &&
          ts.isStringLiteral(node.initializer) &&
          /(?:MESSAGE|REASON|CUSTOM_TIMEOUT_OPTION|^[A-Z_]+$)/.test(
            node.name.getText(ast)
          ) &&
          human(node.initializer.text)
        )
          messages.add(node.initializer.text)
        if (
          ts.isNewExpression(node) &&
          node.expression.getText(ast) === 'Error' &&
          node.arguments?.length &&
          ts.isStringLiteral(node.arguments[0]) &&
          human(node.arguments[0].text)
        )
          messages.add(node.arguments[0].text)
        if (
          ts.isCallExpression(node) &&
          node.expression.getText(ast) === 'noWhitespaceTest' &&
          ts.isStringLiteral(node.arguments[0])
        )
          messages.add(node.arguments[0].text)
        if (
          ts.isPropertyAssignment(node) &&
          node.name.getText(ast) === 'label' &&
          ts.isStringLiteral(node.initializer) &&
          human(node.initializer.text)
        )
          messages.add(node.initializer.text)
        if (
          ts.isJsxAttribute(node) &&
          node.name.text === 'options' &&
          node.initializer &&
          ts.isJsxExpression(node.initializer) &&
          node.initializer.expression &&
          ts.isArrayLiteralExpression(node.initializer.expression)
        )
          for (const item of node.initializer.expression.elements)
            if (ts.isStringLiteral(item) && human(item.text))
              messages.add(item.text)
        ts.forEachChild(node, visit)
      }
      visit(ast)
    }
  }
}
walk('src')
const format = JSON.parse(fs.readFileSync('.prettierrc', 'utf8'))
fs.writeFileSync(
  'src/i18n/sourceMessages.ts',
  prettier.format(
    `// Generated descriptors for stable form values and internal error messages.\nexport const sourceMessages = [\n${[
      ...messages
    ]
      .sort()
      .map((id) => `/* i18n */ { id: ${JSON.stringify(id)} }`)
      .join(',\n')}\n]\n`,
    { ...format, parser: 'typescript' }
  )
)
