import { describe, expect, it } from 'vitest'

import { reduceConfirm } from './confirm-flow'

describe('reduceConfirm', () => {
  it('finishes a single confirmation', () => {
    const opened = reduceConfirm({ phase: 'closed' }, { type: 'open', steps: 1 })
    expect(opened.finished).toBe(false)
    expect(opened.flow).toEqual({ phase: 'first', steps: 1 })
    const done = reduceConfirm(opened.flow, { type: 'confirm' })
    expect(done.finished).toBe(true)
    expect(done.flow.phase).toBe('closed')
  })

  it('asks twice before a two-step confirmation finishes', () => {
    const opened = reduceConfirm({ phase: 'closed' }, { type: 'open', steps: 2 })
    const second = reduceConfirm(opened.flow, { type: 'confirm' })
    expect(second.finished).toBe(false)
    expect(second.flow.phase).toBe('second')
    const done = reduceConfirm(second.flow, { type: 'confirm' })
    expect(done.finished).toBe(true)
  })

  it('does not finish when the second step is cancelled', () => {
    const opened = reduceConfirm({ phase: 'closed' }, { type: 'open', steps: 2 })
    const second = reduceConfirm(opened.flow, { type: 'confirm' })
    const cancelled = reduceConfirm(second.flow, { type: 'cancel' })
    expect(cancelled.finished).toBe(false)
    expect(cancelled.flow.phase).toBe('closed')
  })
})
