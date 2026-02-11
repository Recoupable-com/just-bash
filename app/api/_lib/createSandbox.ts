import { Sandbox } from "@vercel/sandbox";

/**
 * Create a Vercel Sandbox and seed it with files.
 */
export async function createSandbox(
  files: Array<{ path: string; content: Buffer }>
): Promise<Sandbox> {
  const sandbox = await Sandbox.create();
  if (files.length > 0) {
    await sandbox.writeFiles(files);
  }
  return sandbox;
}
