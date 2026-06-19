import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";

export const emails = sqliteTable(
	"emails",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
		message_id: text("message_id"),
		from_addr: text("from_addr").notNull(),
		to_addr: text("to_addr").notNull(),
		subject: text("subject"),
		received_at: text("received_at").notNull(),
		r2_key: text("r2_key").notNull(),
		size_bytes: integer("size_bytes"),
		snippet: text("snippet"),
		starred: integer("starred", { mode: "boolean" }).default(false).notNull(),
		deleted: integer("deleted", { mode: "boolean" }).default(false).notNull(),
		deleted_at: text("deleted_at"),
		trashExpiredDate: text("trash_expired_date"),
		read: integer("read", { mode: "boolean" }).default(false).notNull(),
		verification_code: text("verification_code"),
		summary: text("summary"),
		category: text("category"),
	},
	(table) => ({
		toDeletedReceivedIdx: index("emails_to_deleted_received_idx").on(
			table.to_addr,
			table.deleted,
			table.received_at
		),
		toStarredDeletedReceivedIdx: index("emails_to_starred_deleted_received_idx").on(
			table.to_addr,
			table.starred,
			table.deleted,
			table.received_at
		),
		toCategoryDeletedReceivedIdx: index("emails_to_category_deleted_received_idx").on(
			table.to_addr,
			table.category,
			table.deleted,
			table.received_at
		),
		deletedDeletedAtIdx: index("emails_deleted_deleted_at_idx").on(
			table.deleted,
			table.deleted_at
		),
		deletedTrashExpiredIdx: index("emails_deleted_trash_expired_idx").on(
			table.deleted,
			table.trashExpiredDate
		),
	})
);

export const userEmails = sqliteTable("user_emails", {
	userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
	emailAddress: text("email_address").primaryKey(),
	createdAt: text("created_at").notNull(),
	expiredDate: text("expired_date"),
});

export const sentEmails = sqliteTable(
	"sent_emails",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
		from_addr: text("from_addr").notNull(),
		to_addr: text("to_addr").notNull(),
		subject: text("subject"),
		snippet: text("snippet"),
		received_at: text("received_at").notNull(), // using received_at to match EmailRow interface shape
	},
	(table) => ({
		fromReceivedIdx: index("sent_emails_from_received_idx").on(
			table.from_addr,
			table.received_at
		),
	})
);

export const draftEmails = sqliteTable(
	"draft_emails",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
		from_addr: text("from_addr").notNull(),
		to_addr: text("to_addr"),
		subject: text("subject"),
		text: text("text"),
		updated_at: text("updated_at").notNull(),
	},
	(table) => ({
		fromUpdatedIdx: index("draft_emails_from_updated_idx").on(
			table.from_addr,
			table.updated_at
		),
	})
);

export const systemSettings = sqliteTable("system_settings", {
	id: text("id").primaryKey(),
	schemaVersion: integer("schema_version").notNull(),
	payload: text("payload").notNull(),
	updatedAt: text("updated_at").notNull(),
	updatedBy: text("updated_by"),
});

export type EmailRow = typeof emails.$inferSelect;
export type UserEmailRow = typeof userEmails.$inferSelect;
export type SentEmailRow = typeof sentEmails.$inferSelect;
export type DraftEmailRow = typeof draftEmails.$inferSelect;
export type SystemSettingsRow = typeof systemSettings.$inferSelect;
