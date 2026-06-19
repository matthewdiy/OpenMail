CREATE TABLE `system_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`schema_version` integer NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text
);
--> statement-breakpoint
INSERT INTO `system_settings`("id", "schema_version", "payload", "updated_at", "updated_by") SELECT "id", "schema_version", "payload", "updated_at", "updated_by" FROM `system_config`;--> statement-breakpoint
DROP TABLE `system_config`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `user` ADD `settings` text;
