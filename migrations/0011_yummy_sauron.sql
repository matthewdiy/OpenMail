CREATE TABLE `system_config` (
	`id` text PRIMARY KEY NOT NULL,
	`schema_version` integer NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by` text
);
