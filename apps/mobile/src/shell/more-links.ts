import { roleAtLeast, type OperatorRole } from './roles'

export interface MoreLink {
  id: string
  href: string
  title: string
  description: string
  /** この権限以上のときだけ出す。未指定なら全員。 */
  minimumRole?: OperatorRole
}

export function visibleMoreLinks(links: readonly MoreLink[], role: OperatorRole | null): MoreLink[] {
  return links.filter((link) => !link.minimumRole || roleAtLeast(role, link.minimumRole))
}
