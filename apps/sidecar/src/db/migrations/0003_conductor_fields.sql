-- Conductor-style schema additions
-- Enhances workspaces, sessions, session_messages, repos, and diff_comments
-- Adds new attachments table

-- Workspaces: Add Conductor-style fields
ALTER TABLE `workspaces` ADD COLUMN `derived_status` text DEFAULT 'in-progress';
--> statement-breakpoint
ALTER TABLE `workspaces` ADD COLUMN `manual_status` text;
--> statement-breakpoint
ALTER TABLE `workspaces` ADD COLUMN `pinned_at` text;
--> statement-breakpoint
ALTER TABLE `workspaces` ADD COLUMN `notes` text;
--> statement-breakpoint
ALTER TABLE `workspaces` ADD COLUMN `linked_workspace_ids` text;
--> statement-breakpoint
ALTER TABLE `workspaces` ADD COLUMN `unread` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `workspaces` ADD COLUMN `active_session_id` text;
--> statement-breakpoint
ALTER TABLE `workspaces` ADD COLUMN `big_terminal_mode` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `workspaces` ADD COLUMN `intended_target_branch` text;
--> statement-breakpoint

-- Sessions: Add Conductor-style fields
ALTER TABLE `sessions` ADD COLUMN `title` text DEFAULT 'Untitled';
--> statement-breakpoint
ALTER TABLE `sessions` ADD COLUMN `claude_session_id` text;
--> statement-breakpoint
ALTER TABLE `sessions` ADD COLUMN `permission_mode` text DEFAULT 'default';
--> statement-breakpoint
ALTER TABLE `sessions` ADD COLUMN `thinking_enabled` integer DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `sessions` ADD COLUMN `codex_thinking_level` text;
--> statement-breakpoint
ALTER TABLE `sessions` ADD COLUMN `context_used_percent` text;
--> statement-breakpoint
ALTER TABLE `sessions` ADD COLUMN `is_compacting` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `sessions` ADD COLUMN `freshly_compacted` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `sessions` ADD COLUMN `is_hidden` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `sessions` ADD COLUMN `unread_count` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `sessions` ADD COLUMN `last_user_message_at` text;
--> statement-breakpoint
ALTER TABLE `sessions` ADD COLUMN `resume_session_at` text;
--> statement-breakpoint

-- Session Messages: Add Conductor-style fields
ALTER TABLE `session_messages` ADD COLUMN `full_message` text;
--> statement-breakpoint
ALTER TABLE `session_messages` ADD COLUMN `model` text;
--> statement-breakpoint
ALTER TABLE `session_messages` ADD COLUMN `sent_at` text;
--> statement-breakpoint
ALTER TABLE `session_messages` ADD COLUMN `cancelled_at` text;
--> statement-breakpoint
ALTER TABLE `session_messages` ADD COLUMN `sdk_message_id` text;
--> statement-breakpoint
ALTER TABLE `session_messages` ADD COLUMN `last_assistant_message_id` text;
--> statement-breakpoint
CREATE INDEX `session_messages_sent_at_idx` ON `session_messages` (`session_id`, `sent_at`);
--> statement-breakpoint

-- Repos: Add Conductor-style fields
ALTER TABLE `repos` ADD COLUMN `archive_script` text;
--> statement-breakpoint
ALTER TABLE `repos` ADD COLUMN `run_script_mode` text DEFAULT 'concurrent';
--> statement-breakpoint
ALTER TABLE `repos` ADD COLUMN `custom_prompt_code_review` text;
--> statement-breakpoint
ALTER TABLE `repos` ADD COLUMN `custom_prompt_create_pr` text;
--> statement-breakpoint
ALTER TABLE `repos` ADD COLUMN `custom_prompt_rename_branch` text;
--> statement-breakpoint
ALTER TABLE `repos` ADD COLUMN `conductor_config` text;
--> statement-breakpoint
ALTER TABLE `repos` ADD COLUMN `display_order` integer DEFAULT 0;
--> statement-breakpoint

-- Diff Comments: Add Conductor-style fields
ALTER TABLE `diff_comments` ADD COLUMN `state` text DEFAULT 'active';
--> statement-breakpoint
ALTER TABLE `diff_comments` ADD COLUMN `location` text;
--> statement-breakpoint
ALTER TABLE `diff_comments` ADD COLUMN `author` text;
--> statement-breakpoint
ALTER TABLE `diff_comments` ADD COLUMN `thread_id` text;
--> statement-breakpoint
ALTER TABLE `diff_comments` ADD COLUMN `reply_to_comment_id` text;
--> statement-breakpoint
ALTER TABLE `diff_comments` ADD COLUMN `remote_url` text;
--> statement-breakpoint
ALTER TABLE `diff_comments` ADD COLUMN `update_memory` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `diff_comments` ADD COLUMN `updated_at` text DEFAULT (datetime('now')) NOT NULL;
--> statement-breakpoint

-- Attachments: New table for file attachments
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text,
	`original_name` text,
	`path` text,
	`is_loading` integer DEFAULT 0,
	`is_draft` integer DEFAULT 1,
	`session_id` text,
	`session_message_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_message_id`) REFERENCES `session_messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `attachments_session_id_idx` ON `attachments` (`session_id`);
--> statement-breakpoint
CREATE INDEX `attachments_session_message_id_idx` ON `attachments` (`session_message_id`);
