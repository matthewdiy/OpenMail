CREATE TABLE `user_emails` (
	`user_id` text NOT NULL,
	`email_address` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `emails` ADD `user_id` text REFERENCES user(id);