-- Add collaborative column to worktrees table
ALTER TABLE `worktrees` ADD COLUMN `collaborative` integer DEFAULT false;
