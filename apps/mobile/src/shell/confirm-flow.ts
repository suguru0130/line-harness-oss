export type ConfirmSteps = 1 | 2

export type ConfirmFlow =
  | { phase: 'closed' }
  | { phase: 'first'; steps: ConfirmSteps }
  | { phase: 'second' }

export type ConfirmAction =
  | { type: 'open'; steps: ConfirmSteps }
  | { type: 'confirm' }
  | { type: 'cancel' }

export interface ConfirmResult {
  flow: ConfirmFlow
  finished: boolean
}

/** 1 段階、または 2 段階の確認。2 段階目の確認で finished になる。 */
export function reduceConfirm(flow: ConfirmFlow, action: ConfirmAction): ConfirmResult {
  if (action.type === 'open') {
    return { flow: { phase: 'first', steps: action.steps }, finished: false }
  }
  if (action.type === 'cancel') {
    return { flow: { phase: 'closed' }, finished: false }
  }
  if (flow.phase === 'first' && flow.steps === 2) {
    return { flow: { phase: 'second' }, finished: false }
  }
  if (flow.phase === 'first' || flow.phase === 'second') {
    return { flow: { phase: 'closed' }, finished: true }
  }
  return { flow, finished: false }
}
