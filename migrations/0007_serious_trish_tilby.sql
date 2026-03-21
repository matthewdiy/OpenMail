CREATE TABLE `sent_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`from_addr` text NOT NULL,
	`to_addr` text NOT NULL,
	`subject` text,
	`snippet` text,
	`received_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
