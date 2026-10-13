import { settingsMoreLink } from './settings'
import type { MoreLink } from '@/shell/more-links'

/**
 * その他タブの入口。
 * 機能を足すときは `src/navigation/more/<名前>.ts` を作り、この配列の末尾に 1 行足す。
 * 並び替えや他の行の編集はしない。手順は `apps/mobile/CONTRIBUTING-screens.md`。
 */
export const moreLinks: MoreLink[] = [settingsMoreLink]
