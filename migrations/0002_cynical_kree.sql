ALTER TABLE `emails` ADD `starred` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `emails` ADD `deleted` integer DEFAULT false NOT NULL;