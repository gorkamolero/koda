-- Activity feed for agent events and file changes
CREATE TABLE `activity` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `workspace_id` TEXT NOT NULL,
  `type` TEXT NOT NULL,
  `title` TEXT NOT NULL,
  `description` TEXT,
  `navigate_to` TEXT,
  `read` INTEGER DEFAULT 0,
  `created_at` INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `activity_workspace_id_idx` ON `activity`(`workspace_id`);
--> statement-breakpoint
CREATE INDEX `activity_workspace_read_idx` ON `activity`(`workspace_id`, `read`);
