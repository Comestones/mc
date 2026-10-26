import { pgTable, text, uuid, timestamp, integer, boolean, primaryKey, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
const time = name => timestamp(name, { withTimezone: true });
export const users = pgTable('mc_users', {
  id: uuid('id').primaryKey(), email: text('email').notNull().unique(), passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(), isAdmin: boolean('is_admin').notNull().default(false), disabledAt: time('disabled_at'), createdAt: time('created_at').notNull().defaultNow(),
}, table => [check('mc_email_normalized', sql`${table.email} = lower(btrim(${table.email})) AND length(${table.email}) BETWEEN 3 AND 254`)]);
export const workspaces = pgTable('mc_workspaces', {
  id: text('id').primaryKey(), name: text('name').notNull(), createdBy: uuid('created_by').notNull().references(() => users.id), createdAt: time('created_at').notNull().defaultNow(),
});
export const memberships = pgTable('mc_memberships', {
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }), role: text('role').notNull(),
}, table => [primaryKey({ columns: [table.workspaceId, table.userId] }), check('mc_membership_role', sql`${table.role} IN ('owner', 'editor')`)]);
export const inviteTokens = pgTable('mc_invite_tokens', {
  id: uuid('id').primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').notNull().references(() => users.id), tokenHash: text('token_hash').notNull().unique(),
  expiresAt: time('expires_at').notNull(), maxUses: integer('max_uses').notNull().default(1), uses: integer('uses').notNull().default(0), revokedAt: time('revoked_at'),
}, table => [check('mc_invite_uses', sql`${table.maxUses} > 0 AND ${table.uses} >= 0 AND ${table.uses} <= ${table.maxUses}`)]);
export const documentMeta = pgTable('mc_document_meta', {
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), id: text('id').notNull(), createdBy: uuid('created_by').notNull().references(() => users.id),
  deletedAt: time('deleted_at'), createdAt: time('created_at').notNull().defaultNow(),
}, table => [primaryKey({ columns: [table.workspaceId, table.kind, table.id] }), check('mc_document_kind', sql`${table.kind} IN ('page', 'database')`)]);
export const sessions = pgTable('mc_sessions', {
  id: uuid('id').primaryKey(), userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshHash: text('refresh_hash').notNull().unique(), expiresAt: time('expires_at').notNull(), revokedAt: time('revoked_at'), createdAt: time('created_at').notNull().defaultNow(),
});

export const setupState = pgTable('mc_setup_state', {
  id: integer('id').primaryKey(), completedAt: time('completed_at').notNull().defaultNow(),
}, table => [check('mc_setup_state_id_check', sql`${table.id} = 1`)]);
