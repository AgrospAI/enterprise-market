import { remark } from 'remark'
import remarkHtml from 'remark-html'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeStringify from 'rehype-stringify'
import remarkToc from 'remark-toc'

interface MarkdownToHtmlOptions {
  openLinksInNewTab?: boolean
}

interface RehypeElement {
  type: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: RehypeElement[]
}

function rehypeNewTabLinks() {
  return (tree: RehypeElement) => {
    function visit(node: RehypeElement) {
      if (node.type === 'element' && node.tagName === 'a') {
        node.properties = {
          ...node.properties,
          target: '_blank',
          rel: 'noopener noreferrer'
        }
      }

      node.children?.forEach(visit)
    }

    visit(tree)
  }
}

function isHttpsUrl(href: unknown): boolean {
  try {
    return typeof href === 'string' && new URL(href).protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * For text written by the language model, which publishers can influence through
 * their asset descriptions. Images would load a URL without any click, so they
 * are removed, and a link is only kept if it is https. A link that is not keeps
 * its text.
 */
function rehypeChatSafeContent() {
  function clean(children: RehypeElement[] = []): RehypeElement[] {
    return children.flatMap((node) => {
      if (node.type !== 'element') return [node]
      if (node.tagName === 'img') return []

      const content = clean(node.children)
      if (node.tagName !== 'a') return [{ ...node, children: content }]
      if (!isHttpsUrl(node.properties?.href)) return content

      return [
        {
          ...node,
          children: content,
          properties: {
            href: node.properties.href,
            target: '_blank',
            rel: 'noopener noreferrer'
          }
        }
      ]
    })
  }

  return (tree: RehypeElement) => {
    tree.children = clean(tree.children)
  }
}

/** Markdown from the language model, as HTML that is safe to render. */
export function markdownToChatHtml(markdown: string): string {
  return remark()
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkRehype)
    .use(rehypeChatSafeContent)
    .use(rehypeStringify)
    .processSync(markdown)
    .toString()
}

export function markdownToHtml(
  markdown: string,
  options: MarkdownToHtmlOptions = {}
): string {
  if (options.openLinksInNewTab) {
    const result = remark()
      .use(remarkGfm)
      .use(remarkBreaks)
      .use(remarkRehype)
      .use(rehypeNewTabLinks)
      .use(rehypeStringify)
      .processSync(markdown)

    return result.toString()
  }

  const result = remark()
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkHtml) // serializes through remark-rehype and rehype-stringify
    .processSync(markdown)

  return result.toString()
}

export function markdownToHtmlWithToc(markdown: string): string {
  const result = remark()
    .use(remarkGfm)
    .use(remarkBreaks)
    .use(remarkToc)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeStringify)
    .processSync(markdown)

  return result.toString()
}
