import { readdirSync, readFileSync } from "fs";
import { join, relative } from "path";

/**
 * Recursively read all files from a directory, returning them in the format
 * expected by Sandbox.writeFiles().
 */
export function readSourceFiles(
  dir: string,
  destDir: string,
  baseDir?: string
): Array<{ path: string; content: Buffer }> {
  const base = baseDir ?? dir;
  const files: Array<{ path: string; content: Buffer }> = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      files.push(...readSourceFiles(fullPath, destDir, base));
    } else {
      const relPath = relative(base, fullPath);
      files.push({
        path: join(destDir, relPath),
        content: readFileSync(fullPath),
      });
    }
  }

  return files;
}
