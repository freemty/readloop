import { describe, it, expect } from 'vitest'
import { buildUpdateFiles, applyBumpConfidence } from '../updateWiki'
import type { UpdateJudgment } from '../types'

describe('buildUpdateFiles', () => {
  it('returns empty for worth_saving=false', () => {
    const judgment: UpdateJudgment = { worth_saving: false, updates: [], conversation_summary: '' }
    const files = buildUpdateFiles(judgment, 'ch01', 1, '前奏 大国幻象')
    expect(files).toEqual([])
  })

  it('creates conversation file when worth saving', () => {
    const judgment: UpdateJudgment = { worth_saving: true, updates: [], conversation_summary: 'Key insight about economy' }
    const files = buildUpdateFiles(judgment, 'ch01', 1, '前奏 大国幻象')
    const convFile = files.find(f => f.path.startsWith('conversations/'))
    expect(convFile).toBeTruthy()
    expect(convFile!.content).toContain('Key insight about economy')
  })

  it('creates update_concept append file', () => {
    const judgment: UpdateJudgment = {
      worth_saving: true,
      updates: [{ action: 'update_concept', target: 'concepts/大国幻象.md', delta: 'New understanding...' }],
      conversation_summary: 'summary',
    }
    const files = buildUpdateFiles(judgment, 'ch01', 1, '前奏')
    const updateFile = files.find(f => f.path === 'concepts/大国幻象.md')
    expect(updateFile).toBeTruthy()
    expect(updateFile!.mode).toBe('append')
    expect(updateFile!.content).toContain('New understanding...')
  })

  it('creates new concept file for create_concept', () => {
    const judgment: UpdateJudgment = {
      worth_saving: true,
      updates: [{
        action: 'create_concept',
        title: '信息茧房',
        slug: '信息茧房',
        summary: 'Echo chamber effect',
        related: ['大国幻象'],
      }],
      conversation_summary: 'summary',
    }
    const files = buildUpdateFiles(judgment, 'ch01', 1, '前奏')
    const newConcept = files.find(f => f.path === 'concepts/信息茧房.md')
    expect(newConcept).toBeTruthy()
    expect(newConcept!.mode).toBe('write')
    expect(newConcept!.content).toContain('title: "信息茧房"')
  })
})

describe('applyBumpConfidence', () => {
  it('replaces confidence in frontmatter', () => {
    const content = `---\ntitle: "Test"\nconfidence: low\n---\nBody`
    const result = applyBumpConfidence(content, 'medium')
    expect(result).toContain('confidence: medium')
    expect(result).not.toContain('confidence: low')
  })
  it('returns unchanged if no confidence field', () => {
    const content = `---\ntitle: "Test"\n---\nBody`
    const result = applyBumpConfidence(content, 'medium')
    expect(result).toBe(content)
  })
})
