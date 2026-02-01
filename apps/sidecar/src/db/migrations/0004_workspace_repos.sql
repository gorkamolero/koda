-- Workspace Repos: Decouples workspace identity from repo attachment
--
-- This enables:
-- - Cloud workspaces with no local repo
-- - Multi-repo workspaces (each repo gets its own worktree)
-- - Collaboration without requiring matching local repos
--
-- Repos are horizontal - no hierarchy, no "primary".
-- Each attachment represents one worktree for that repo in the workspace.

CREATE TABLE `workspace_repos` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`repo_id` text NOT NULL,
	`worktree_path` text,
	`branch` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`repo_id`) REFERENCES `repos`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint

-- Create indexes for common queries
CREATE INDEX `workspace_repos_workspace_id_idx` ON `workspace_repos` (`workspace_id`);
--> statement-breakpoint
CREATE INDEX `workspace_repos_repo_id_idx` ON `workspace_repos` (`repo_id`);
--> statement-breakpoint

-- Migrate existing workspace-repo relationships to the new table
-- This preserves backward compatibility with existing data
INSERT INTO `workspace_repos` (`id`, `workspace_id`, `repo_id`, `branch`, `created_at`)
SELECT
  lower(hex(randomblob(16))),
  w.id,
  w.repository_id,
  w.branch,
  datetime('now')
FROM `workspaces` w
WHERE w.repository_id IS NOT NULL;
