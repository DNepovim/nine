import { marked, type Token, type Tokens } from 'marked'

// marked's token tree is richer than these cards need, so it's flattened into a
// short list of blocks with inline runs. Anything unsupported degrades to its
// plain text — a stray token must never blank an announcement.

export type Inline = {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  href?: string
}

export type Block =
  | { type: 'heading'; level: number; spans: Inline[] }
  | { type: 'paragraph'; spans: Inline[] }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'rule' }

// Walks inline tokens, carrying emphasis down through nesting so that
// **bold *and italic*** keeps both.
function inlines(
  tokens: readonly Token[] | undefined,
  carry: Inline = { text: '' },
): Inline[] {
  if (tokens === undefined) return []
  return tokens.flatMap((token): Inline[] => {
    switch (token.type) {
      case 'strong':
        return inlines((token as Tokens.Strong).tokens, { ...carry, bold: true })
      case 'em':
        return inlines((token as Tokens.Em).tokens, { ...carry, italic: true })
      case 'link': {
        const link = token as Tokens.Link
        return inlines(link.tokens, { ...carry, href: link.href })
      }
      case 'codespan':
        return [{ ...carry, text: (token as Tokens.Codespan).text, code: true }]
      case 'br':
        return [{ ...carry, text: '\n' }]
      case 'escape':
      case 'text': {
        const text = token as Tokens.Text
        // A text token can itself hold inline children (e.g. inside a list item).
        if (text.tokens !== undefined && text.tokens.length > 0) {
          return inlines(text.tokens, carry)
        }
        return [{ ...carry, text: text.text }]
      }
      default: {
        const raw = 'raw' in token ? token.raw : ''
        return raw === '' ? [] : [{ ...carry, text: raw }]
      }
    }
  })
}

export function parseMarkdown(source: string): Block[] {
  const tokens = marked.lexer(source)
  return tokens.flatMap((token): Block[] => {
    switch (token.type) {
      case 'heading': {
        const heading = token as Tokens.Heading
        return [{ type: 'heading', level: heading.depth, spans: inlines(heading.tokens) }]
      }
      case 'paragraph': {
        const paragraph = token as Tokens.Paragraph
        return [{ type: 'paragraph', spans: inlines(paragraph.tokens) }]
      }
      case 'list': {
        const list = token as Tokens.List
        return [
          {
            type: 'list',
            ordered: list.ordered,
            items: list.items.map((item) => inlines(item.tokens)),
          },
        ]
      }
      case 'blockquote': {
        const quote = token as Tokens.Blockquote
        return parseMarkdown(quote.text)
      }
      case 'code':
        return [
          {
            type: 'paragraph',
            spans: [{ text: (token as Tokens.Code).text, code: true }],
          },
        ]
      case 'hr':
        return [{ type: 'rule' }]
      case 'space':
        return []
      default: {
        const raw = 'raw' in token ? token.raw.trim() : ''
        return raw === '' ? [] : [{ type: 'paragraph', spans: [{ text: raw }] }]
      }
    }
  })
}
