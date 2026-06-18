ALTER TABLE `emails` ADD `trash_expired_date` text;--> statement-breakpoint
CREATE INDEX `emails_deleted_trash_expired_idx` ON `emails` (`deleted`,`trash_expired_date`);