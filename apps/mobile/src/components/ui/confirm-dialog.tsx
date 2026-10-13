import { useState } from 'react'
import { Modal, Text, View } from 'react-native'

import { reduceConfirm, type ConfirmFlow, type ConfirmSteps } from '@/shell/confirm-flow'

import { Button } from './button'

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'キャンセル',
  secondTitle,
  secondMessage,
  secondConfirmLabel,
  tone = 'default',
  onConfirm,
  onCancel,
}: {
  visible: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel?: string
  secondTitle?: string
  secondMessage?: string
  secondConfirmLabel?: string
  tone?: 'default' | 'danger'
  onConfirm: () => void
  onCancel: () => void
}) {
  const steps: ConfirmSteps = secondTitle ? 2 : 1
  const openId = `${visible ? 'open' : 'closed'}:${steps}`
  const [seenOpenId, setSeenOpenId] = useState(openId)
  const [phase, setPhase] = useState<'first' | 'second'>('first')
  const reset = openId !== seenOpenId
  if (reset) {
    setSeenOpenId(openId)
    setPhase('first')
  }
  const shownPhase = reset ? 'first' : phase
  const flow: ConfirmFlow = !visible
    ? { phase: 'closed' }
    : shownPhase === 'second'
      ? { phase: 'second' }
      : { phase: 'first', steps }

  const showingSecond = flow.phase === 'second'
  const headline = showingSecond && secondTitle ? secondTitle : title
  const body = showingSecond && secondMessage ? secondMessage : message
  const confirmText = showingSecond && secondConfirmLabel ? secondConfirmLabel : confirmLabel

  function confirm() {
    const result = reduceConfirm(flow, { type: 'confirm' })
    setPhase(result.flow.phase === 'second' ? 'second' : 'first')
    if (result.finished) onConfirm()
  }

  function cancel() {
    setPhase('first')
    onCancel()
  }

  return (
    <Modal visible={visible && flow.phase !== 'closed'} transparent animationType="fade" onRequestClose={cancel}>
      <View className="flex-1 items-center justify-center bg-black/40 px-6">
        <View className="w-full max-w-sm rounded-2xl bg-white p-5" accessibilityViewIsModal>
          {steps === 2 ? (
            <Text className="text-xs font-medium text-neutral-500">{showingSecond ? '2 / 2' : '1 / 2'}</Text>
          ) : null}
          <Text className="mt-1 text-lg font-bold text-neutral-900">{headline}</Text>
          <Text className="mt-2 text-sm leading-5 text-neutral-600">{body}</Text>
          <View className="mt-5 gap-2">
            <Button
              label={confirmText}
              variant={tone === 'danger' ? 'danger' : 'primary'}
              onPress={confirm}
            />
            <Button label={cancelLabel} variant="secondary" onPress={cancel} />
          </View>
        </View>
      </View>
    </Modal>
  )
}
