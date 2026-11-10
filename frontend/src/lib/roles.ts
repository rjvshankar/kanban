// What each board role can do. Shared by the permission checks and the legend in the Members dialog.

import type { Role } from '../api/types'

export const ROLES: Role[] = ['owner', 'editor', 'viewer']

export const ROLE_INFO: Record<Role, string> = {
  owner: 'Everything: manage columns, rename or delete the board, manage members, plus all card actions.',
  editor: 'Create, edit, move and delete cards. Cannot change columns or members.',
  viewer: 'Read-only. Can see the board but not change anything.',
}
