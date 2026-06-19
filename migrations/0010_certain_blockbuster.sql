CREATE TABLE `draft_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`from_addr` text NOT NULL,
	`to_addr` text,
	`subject` text,
	`text` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `draft_emails_from_updated_idx` ON `draft_emails` (`from_addr`,`updated_at`);