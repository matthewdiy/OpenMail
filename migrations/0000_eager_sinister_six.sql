CREATE TABLE `emails` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text,
	`from_addr` text NOT NULL,
	`to_addr` text NOT NULL,
	`subject` text,
	`received_at` text NOT NULL,
	`r2_key` text NOT NULL,
	`size_bytes` integer,
	`snippet` text
);
