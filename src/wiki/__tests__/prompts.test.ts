import { describe, it, expect } from 'vitest'
import { buildInitPrompt, buildUpdateJudgmentPrompt } from '../prompts'

describe('buildInitPrompt', () => {
  it('includes book title and author', () => {
    const result = buildInitPrompt('疫年纪事', '李厚辰', '第一章内容...', [])
    expect(result).toContain('疫年纪事')
    expect(result).toContain('李厚辰')
  })
  it('includes chapter text', () => {
    const result = buildInitPrompt('Book', 'Author', 'Chapter text here', [])
    expect(result).toContain('Chapter text here')
  })
  it('includes existing concepts for dedup', () => {
    const result = buildInitPrompt('Book', 'Author', 'text', ['concept-a', 'concept-b'])
    expect(result).toContain('concept-a')
    expect(result).toContain('concept-b')
  })
})

describe('buildUpdateJudgmentPrompt', () => {
  it('includes conversation messages', () => {
    const result = buildUpdateJudgmentPrompt(
      '疫年纪事', '李厚辰', '前奏 大国幻象',
      [{ role: 'user', content: '这里怎么理解', timestamp: 0 }],
      ['大国幻象: 初始摘要']
    )
    expect(result).toContain('这里怎么理解')
  })
  it('includes existing wiki nodes', () => {
    const result = buildUpdateJudgmentPrompt(
      'Book', 'Author', 'Ch1',
      [{ role: 'user', content: 'question', timestamp: 0 }],
      ['concept-a: summary of concept a']
    )
    expect(result).toContain('concept-a: summary of concept a')
  })
})
