CREATE TABLE `diff_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`user_id` text,
	`file_path` text,
	`line_number` integer,
	`body` text,
	`resolved` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `git_checkpoints` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`turn_id` text,
	`head_oid` text,
	`index_tree` text,
	`worktree_tree` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `git_identities` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`provider` text,
	`username` text,
	`email` text,
	`token_encrypted` text,
	`is_default` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `repos` (
	`id` text PRIMARY KEY NOT NULL,
	`remote_url` text,
	`name` text,
	`default_branch` text DEFAULT 'main',
	`root_path` text,
	`git_identity_id` text,
	`setup_script` text,
	`run_script` text,
	`custom_prompt` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`git_identity_id`) REFERENCES `git_identities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`role` text,
	`content` text,
	`full_message_json` text,
	`turn_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`agent_type` text,
	`model` text,
	`status` text DEFAULT 'idle',
	`context_token_count` integer DEFAULT 0,
	`forked_from_session_id` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text,
	`name` text,
	`avatar_url` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visual_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`session_id` text,
	`turn_id` text,
	`snapshot_type` text,
	`image_path` text,
	`url` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workspace_shares` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text,
	`shared_with_user_id` text,
	`permission` text DEFAULT 'view',
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shared_with_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`repository_id` text,
	`owner_user_id` text,
	`directory_name` text,
	`branch` text,
	`workspace_type` text DEFAULT 'standard',
	`state` text DEFAULT 'active',
	`spec_content` text,
	`fix_plan_content` text,
	`ralph_enabled` integer DEFAULT false,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`repository_id`) REFERENCES `repos`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
