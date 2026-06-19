CREATE INDEX `emails_to_deleted_received_idx` ON `emails` (`to_addr`,`deleted`,`received_at`);--> statement-breakpoint
CREATE INDEX `emails_to_starred_deleted_received_idx` ON `emails` (`to_addr`,`starred`,`deleted`,`received_at`);--> statement-breakpoint
CREATE INDEX `emails_to_category_deleted_received_idx` ON `emails` (`to_addr`,`category`,`deleted`,`received_at`);--> statement-breakpoint
CREATE INDEX `emails_deleted_deleted_at_idx` ON `emails` (`deleted`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `sent_emails_from_received_idx` ON `sent_emails` (`from_addr`,`received_at`);