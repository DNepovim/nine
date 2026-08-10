import { describe, expect, it } from 'vitest'

import { parseMarkdown } from './markdown'

const text = (md: string) =>
  parseMarkdown(md)
    .map((b) => ('spans' in b ? b.spans.map((s) => s.text).join('') : b.type))
    .join(' | ')

describe('parseMarkdown', () => {
  it('reads a paragraph', () => {
    expect(parseMarkdown('Hello there.')).toEqual([
      { type: 'paragraph', spans: [{ text: 'Hello there.' }] },
    ])
  })

  it('splits paragraphs', () => {
    expect(text('One.\n\nTwo.')).toBe('One. | Two.')
  })

  it('marks bold and italic', () => {
    const [block] = parseMarkdown('plain **bold** and *italic*')
    expect(block).toMatchObject({
      type: 'paragraph',
      spans: [
        { text: 'plain ' },
        { text: 'bold', bold: true },
        { text: ' and ' },
        { text: 'italic', italic: true },
      ],
    })
  })

  it('carries emphasis through nesting', () => {
    const [block] = parseMarkdown('***both***')
    expect(block).toMatchObject({
      spans: [{ text: 'both', bold: true, italic: true }],
    })
  })

  it('reads headings with their level', () => {
    expect(parseMarkdown('## Title')).toEqual([
      { type: 'heading', level: 2, spans: [{ text: 'Title' }] },
    ])
  })

  it('reads a bullet list', () => {
    const [block] = parseMarkdown('- one\n- two')
    expect(block).toMatchObject({
      type: 'list',
      ordered: false,
      items: [[{ text: 'one' }], [{ text: 'two' }]],
    })
  })

  it('reads an ordered list', () => {
    const [block] = parseMarkdown('1. first\n2. second')
    expect(block).toMatchObject({ type: 'list', ordered: true })
  })

  it('keeps emphasis inside list items', () => {
    const [block] = parseMarkdown('- a **strong** point')
    expect(block).toMatchObject({
      items: [[{ text: 'a ' }, { text: 'strong', bold: true }, { text: ' point' }]],
    })
  })

  it('reads links with their href', () => {
    const [block] = parseMarkdown('[the site](https://example.com)')
    expect(block).toMatchObject({
      spans: [{ text: 'the site', href: 'https://example.com' }],
    })
  })

  it('reads inline code', () => {
    const [block] = parseMarkdown('run `pnpm check` now')
    expect(block).toMatchObject({
      spans: [{ text: 'run ' }, { text: 'pnpm check', code: true }, { text: ' now' }],
    })
  })

  it('reads a horizontal rule', () => {
    expect(parseMarkdown('---')).toEqual([{ type: 'rule' }])
  })

  it('flattens a blockquote to its content', () => {
    expect(text('> quoted')).toBe('quoted')
  })

  it('returns nothing for empty input', () => {
    expect(parseMarkdown('')).toEqual([])
    expect(parseMarkdown('\n\n')).toEqual([])
  })

  it('degrades an unsupported construct to plain text rather than dropping it', () => {
    const blocks = parseMarkdown('| a | b |\n| - | - |\n| 1 | 2 |')
    expect(blocks.length).toBeGreaterThan(0)
    expect(JSON.stringify(blocks)).toContain('a')
  })
})
