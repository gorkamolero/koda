CREATE TABLE `session_recordings` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text,
	`name` text,
	`description` text,
	`status` text DEFAULT 'recording',
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`ended_at` text,
	`duration_ms` integer,
	`frame_count` integer DEFAULT 0,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
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
CREATE INDEX `session_recordings_session_id_idx` ON `session_recordings` (`session_id`);
--> statement-breakpoint
CREATE INDEX `recording_frames_recording_id_idx` ON `recording_frames` (`recording_id`);
--> statement-breakpoint
CREATE INDEX `recording_frames_message_id_idx` ON `recording_frames` (`message_id`);
