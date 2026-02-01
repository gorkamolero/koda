import { z } from 'zod';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * File entry schema for directory listing
 */
export const FileEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(['file', 'directory']),
});

export type FileEntry = z.infer<typeof FileEntrySchema>;

/**
 * Input schema for readDirectory
 */
export const ReadDirectoryInputSchema = z.object({
  path: z.string(),
});

/**
 * Input schema for readFile
 */
export const ReadFileInputSchema = z.object({
  path: z.string(),
});

/**
 * Read directory contents
 */
export async function readDirectory(
  input: z.infer<typeof ReadDirectoryInputSchema>
): Promise<FileEntry[]> {
  const dirPath = input.path;

  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  // Sort: directories first, then alphabetically
  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  return sorted.map((entry) => ({
    name: entry.name,
    path: path.join(dirPath, entry.name),
    type: entry.isDirectory() ? 'directory' : 'file',
  }));
}

/**
 * Read file contents as text
 */
export async function readFile(
  input: z.infer<typeof ReadFileInputSchema>
): Promise<string> {
  const content = await fs.readFile(input.path, 'utf-8');
  return content;
}
