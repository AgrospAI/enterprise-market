import fs from 'node:fs'
import matter from 'gray-matter'
import prettier from 'prettier'
const formatting = JSON.parse(fs.readFileSync('.prettierrc', 'utf8'))
const messages = new Set()
for (const entry of fs.readdirSync('content/pages/privacy', {
  withFileTypes: true
})) {
  if (!entry.isDirectory()) continue
  messages.add(
    entry.name
      .split('-')
      .map((word) => word[0].toUpperCase() + word.slice(1))
      .join(' ')
  )
  const file = `content/pages/privacy/${entry.name}/en.md`
  if (!fs.existsSync(file)) continue
  const { data, content } = matter(fs.readFileSync(file, 'utf8'))
  for (const key of ['title', 'description'])
    if (data[key]) messages.add(data[key])
  for (const block of content.split(/\n\s*\n/))
    if (/[a-zA-Z]/.test(block)) messages.add(block)
}
fs.writeFileSync(
  'src/i18n/legalMessages.ts',
  prettier.format(
    `// Generated from the English legal documents.\nexport const legalMessages = [\n${[
      ...messages
    ]
      .sort()
      .map((id) => `  /* i18n */ { id: ${JSON.stringify(id)} }`)
      .join(',\n')}\n]\n`,
    { ...formatting, parser: 'typescript' }
  )
)
