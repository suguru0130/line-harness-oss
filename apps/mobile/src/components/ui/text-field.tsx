import { useState } from 'react'
import { Pressable, Text, TextInput, View } from 'react-native'
import type { KeyboardTypeOptions } from 'react-native'

export function TextField({
  label,
  value,
  onChangeText,
  error,
  secure = false,
  placeholder,
  keyboardType,
  testID,
  kind = 'text',
}: {
  label: string
  value: string
  onChangeText: (value: string) => void
  error?: string | null
  secure?: boolean
  placeholder?: string
  keyboardType?: KeyboardTypeOptions
  testID?: string
  kind?: 'text' | 'url' | 'password'
}) {
  const isPassword = secure || kind === 'password'
  const [hidden, setHidden] = useState(isPassword)
  return (
    <View>
      <Text className="mb-1 text-sm font-medium text-neutral-700">{label}</Text>
      <View className="flex-row items-center rounded-xl border border-neutral-300 bg-white">
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPassword ? hidden : false}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder={placeholder}
          placeholderTextColor="#a3a3a3"
          keyboardType={keyboardType ?? (kind === 'url' ? 'url' : 'default')}
          textContentType={isPassword ? 'password' : kind === 'url' ? 'URL' : 'none'}
          autoComplete={isPassword ? 'password' : kind === 'url' ? 'url' : 'off'}
          className="flex-1 px-4 py-3 text-base text-neutral-900"
          testID={testID}
        />
        {isPassword ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? '入力を表示' : '入力を隠す'}
            onPress={() => setHidden((current) => !current)}
            className="px-3 py-3"
          >
            <Text className="text-sm font-medium text-line">{hidden ? '表示' : '隠す'}</Text>
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text className="mt-1 text-sm text-red-600" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  )
}
