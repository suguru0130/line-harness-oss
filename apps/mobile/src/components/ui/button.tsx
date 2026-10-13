import { Pressable, Text } from 'react-native'

type ButtonVariant = 'primary' | 'secondary' | 'danger'

const containerClass: Record<ButtonVariant, string> = {
  primary: 'items-center rounded-xl bg-line px-4 py-3',
  secondary: 'items-center rounded-xl border border-neutral-300 bg-white px-4 py-3',
  danger: 'items-center rounded-xl bg-red-600 px-4 py-3',
}

const labelClass: Record<ButtonVariant, string> = {
  primary: 'text-base font-semibold text-white',
  secondary: 'text-base font-semibold text-neutral-900',
  danger: 'text-base font-semibold text-white',
}

export function Button({
  label,
  onPress,
  disabled = false,
  variant = 'primary',
  accessibilityLabel,
  testID,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  variant?: ButtonVariant
  accessibilityLabel?: string
  testID?: string
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      className={disabled ? `${containerClass[variant]} opacity-50` : containerClass[variant]}
    >
      <Text className={labelClass[variant]}>{label}</Text>
    </Pressable>
  )
}
