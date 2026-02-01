-- Workspace/Worktree Rearchitecture Migration
--
-- This migration transforms the data model:
-- - OLD: workspaces = worktrees (each workspace tied to a repo/branch)
-- - NEW: workspaces = containers, worktrees = git worktrees
--
-- IMPORTANT: This is a destructive migration. DB should be wiped before running.

-- Step 1: Create the new worktrees table (based on old workspaces)
CREATE TABLE `worktrees` (
	`id` text PRIMARY KEY NOT NULL,
	`repo_id` text NOT NULL,
	`branch` text,
	`worktree_path` text,
	`workspace_ids` text,
	`worktree_type` text DEFAULT 'standard',
	`state` text DEFAULT 'active',
	`spec_content` text,
	`fix_plan_content` text,
	`ralph_enabled` integer DEFAULT false,
	`derived_status` text DEFAULT 'in-progress',
	`manual_status` text,
	`pinned_at` text,
	`notes` text,
	`linked_worktree_ids` text,
	`unread` integer DEFAULT 0,
	`active_session_id` text,
	`big_terminal_mode` integer DEFAULT false,
	`intended_target_branch` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`repo_id`) REFERENCES `repos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- Step 2: Recreate workspaces as pure containers
DROP TABLE IF EXISTS `workspaces`;
--> statement-breakpoint

CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`owner_user_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- Step 3: Recreate workspace_repos (simplified - just links, no branch/path)
DROP TABLE IF EXISTS `workspace_repos`;
--> statement-breakpoint

CREATE TABLE `workspace_repos` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`repo_id` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`repo_id`) REFERENCES `repos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE INDEX `workspace_repos_workspace_id_idx` ON `workspace_repos` (`workspace_id`);
--> statement-breakpoint

CREATE INDEX `workspace_repos_repo_id_idx` ON `workspace_repos` (`repo_id`);
--> statement-breakpoint

-- Step 4: Update sessions to reference worktrees
-- First drop the old sessions table and recreate
DROP TABLE IF EXISTS `recording_frames`;
--> statement-breakpoint

DROP TABLE IF EXISTS `session_recordings`;
--> statement-breakpoint

DROP TABLE IF EXISTS `attachments`;
--> statement-breakpoint

DROP TABLE IF EXISTS `session_messages`;
--> statement-breakpoint

DROP TABLE IF EXISTS `sessions`;
--> statement-breakpoint

CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`worktree_id` text,
	`agent_type` text,
	`model` text,
	`status` text DEFAULT 'idle',
	`context_token_count` integer DEFAULT 0,
	`forked_from_session_id` text,
	`title` text DEFAULT 'Untitled',
	`claude_session_id` text,
	`permission_mode` text DEFAULT 'default',
	`thinking_enabled` integer DEFAULT true,
	`codex_thinking_level` text,
	`context_used_percent` text,
	`is_compacting` integer DEFAULT false,
	`freshly_compacted` integer DEFAULT false,
	`is_hidden` integer DEFAULT false,
	`unread_count` integer DEFAULT 0,
	`last_user_message_at` text,
	`resume_session_at` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`worktree_id`) REFERENCES `worktrees`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE INDEX `sessions_worktree_id_idx` ON `sessions` (`worktree_id`);
--> statement-breakpoint

-- Recreate session_messages
CREATE TABLE `session_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`role` text,
	`content` text,
	`full_message_json` text,
	`turn_id` text,
	`full_message` text,
	`model` text,
	`sent_at` text,
	`cancelled_at` text,
	`sdk_message_id` text,
	`last_assistant_message_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE INDEX `session_messages_session_id_idx` ON `session_messages` (`session_id`);
--> statement-breakpoint

CREATE INDEX `session_messages_sent_at_idx` ON `session_messages` (`session_id`, `sent_at`);
--> statement-breakpoint

-- Recreate attachments
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text,
	`original_name` text,
	`path` text,
	`is_loading` integer DEFAULT false,
	`is_draft` integer DEFAULT true,
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
--> statement-breakpoint

-- Recreate session_recordings
CREATE TABLE `session_recordings` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`name` text,
	`description` text,
	`status` text DEFAULT 'recording',
	`started_at` text DEFAULT (datetime('now')) NOT NULL,
	`ended_at` text,
	`duration_ms` integer,
	`frame_count` integer DEFAULT 0,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE INDEX `session_recordings_session_id_idx` ON `session_recordings` (`session_id`);
--> statement-breakpoint

-- Recreate recording_frames
CREATE TABLE `recording_frames` (
	`id` text PRIMARY KEY NOT NULL,
	`recording_id` text,
	`message_id` text,
	`frame_type` text DEFAULT 'message',
	`offset_ms` integer DEFAULT 0,
	`sequence_number` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`recording_id`) REFERENCES `session_recordings`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`message_id`) REFERENCES `session_messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

CREATE INDEX `recording_frames_recording_id_idx` ON `recording_frames` (`recording_id`);
--> statement-breakpoint

CREATE INDEX `recording_frames_message_id_idx` ON `recording_frames` (`message_id`);
--> statement-breakpoint

-- Step 5: Update diff_comments to reference worktrees
DROP TABLE IF EXISTS `diff_comments`;
--> statement-breakpoint

CREATE TABLE `diff_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`worktree_id` text,
	`user_id` text,
	`file_path` text,
	`line_number` integer,
	`body` text,
	`resolved` integer DEFAULT false,
	`state` text DEFAULT 'active',
	`location` text,
	`author` text,
	`thread_id` text,
	`reply_to_comment_id` text,
	`remote_url` text,
	`update_memory` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`worktree_id`) REFERENCES `worktrees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- Step 6: Update visual_snapshots to reference worktrees
DROP TABLE IF EXISTS `visual_snapshots`;
--> statement-breakpoint

CREATE TABLE `visual_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`worktree_id` text,
	`session_id` text,
	`turn_id` text,
	`snapshot_type` text,
	`image_path` text,
	`url` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`worktree_id`) REFERENCES `worktrees`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- Step 7: Update git_checkpoints to reference worktrees
DROP TABLE IF EXISTS `git_checkpoints`;
--> statement-breakpoint

CREATE TABLE `git_checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`worktree_id` text,
	`turn_id` text,
	`head_oid` text,
	`index_tree` text,
	`worktree_tree` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`worktree_id`) REFERENCES `worktrees`(`id`) ON UPDATE no action ON DELETE no action
);
-- Step 8: Update workspace_shares (stays referencing workspaces - containers)
-- No change needed - workspace_shares already references workspaces correctly
