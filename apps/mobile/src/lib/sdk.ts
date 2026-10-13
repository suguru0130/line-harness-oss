import { LineHarness, type LineHarnessConfig } from '@line-harness/sdk'

import { mobileCredentialStore } from '@/lib/api'

/** 同じ保存先で公式 SDK も使えるようにする。画面からはまだ呼ばない。 */
export function createLineHarness(config: Partial<LineHarnessConfig> = {}) {
  return new LineHarness({
    ...config,
    credentials: config.credentials ?? mobileCredentialStore,
  })
}
