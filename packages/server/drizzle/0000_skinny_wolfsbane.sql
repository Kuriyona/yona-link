CREATE TABLE `api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`permissions` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`type` text NOT NULL,
	`target_url` text NOT NULL,
	`permanent` integer DEFAULT false NOT NULL,
	`expires_at` text,
	`status` text DEFAULT 'active' NOT NULL,
	`retired_at` text,
	`click_count` integer DEFAULT 0 NOT NULL,
	`last_clicked_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `links_code_unique` ON `links` (`code`);--> statement-breakpoint
CREATE INDEX `idx_links_status_retired` ON `links` (`status`,`retired_at`);