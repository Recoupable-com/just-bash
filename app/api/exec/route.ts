import { Sandbox } from "@vercel/sandbox";
import { readdirSync, readFileSync } from "fs";
import { dirname, join, relative } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENT_DATA_DIR = join(__dirname, "../agent/_agent-data");
const SANDBOX_CWD = "/home/user";

function readSourceFiles(
  dir: string,
  baseDir?: string
): Array<{ path: string; content: Buffer }> {
  const base = baseDir ?? dir;
  const files: Array<{ path: string; content: Buffer }> = [];

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      files.push(...readSourceFiles(fullPath, base));
    } else {
      const relPath = relative(base, fullPath);
      files.push({
        path: join(SANDBOX_CWD, relPath),
        content: readFileSync(fullPath),
      });
    }
  }

  return files;
}

async function createAndSeedSandbox(): Promise<Sandbox> {
  const sandbox = await Sandbox.create();

  const files = readSourceFiles(AGENT_DATA_DIR);
  if (files.length > 0) {
    await sandbox.writeFiles(files);
  }

  // Create convenience copies of top-level demo files
  await sandbox.runCommand({
    cmd: "bash",
    args: [
      "-c",
      [
        `mkdir -p ${SANDBOX_CWD}/dirs/are/fun/author`,
        `cp ${SANDBOX_CWD}/just-bash/README.md ${SANDBOX_CWD}/README.md 2>/dev/null || true`,
        `cp ${SANDBOX_CWD}/just-bash/LICENSE ${SANDBOX_CWD}/LICENSE 2>/dev/null || true`,
        `cp ${SANDBOX_CWD}/just-bash/package.json ${SANDBOX_CWD}/package.json 2>/dev/null || true`,
        `echo 'https://x.com/cramforce' > ${SANDBOX_CWD}/dirs/are/fun/author/info.txt`,
      ].join(" && "),
    ],
    cwd: SANDBOX_CWD,
  });

  return sandbox;
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { command, sandboxId } = await req.json();

  if (!command || typeof command !== "string") {
    return Response.json({ error: "Command is required" }, { status: 400 });
  }

  let sandbox: Sandbox;
  let activeSandboxId: string;

  if (sandboxId) {
    try {
      sandbox = await Sandbox.get({ sandboxId });
      activeSandboxId = sandboxId;
    } catch {
      sandbox = await createAndSeedSandbox();
      activeSandboxId = sandbox.sandboxId;
    }
  } else {
    sandbox = await createAndSeedSandbox();
    activeSandboxId = sandbox.sandboxId;
  }

  try {
    const result = await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", command],
      cwd: SANDBOX_CWD,
    });

    const stdout = await result.stdout();
    const stderr = await result.stderr();

    return Response.json({
      stdout,
      stderr,
      exitCode: result.exitCode,
      sandboxId: activeSandboxId,
    });
  } catch (error) {
    return Response.json({
      stdout: "",
      stderr: error instanceof Error ? error.message : "Execution failed",
      exitCode: 1,
      sandboxId: activeSandboxId,
    });
  }
}
