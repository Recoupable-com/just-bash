import { Sandbox } from "@vercel/sandbox";
import { createSandbox } from "../_lib/createSandbox";

const SANDBOX_CWD = "/home/user";

async function fetchSourceFiles(): Promise<
  Array<{ path: string; content: Buffer }>
> {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";
  const res = await fetch(`${baseUrl}/api/fs`);
  if (!res.ok) return [];
  const filesMap: Record<string, string> = await res.json();
  return Object.entries(filesMap).map(([path, content]) => ({
    path: `${SANDBOX_CWD}/${path}`,
    content: Buffer.from(content),
  }));
}

async function createAndSeedSandbox(): Promise<Sandbox> {
  let files: Array<{ path: string; content: Buffer }> = [];
  try {
    files = await fetchSourceFiles();
  } catch {
    // File seeding is best-effort
  }

  const sandbox = await createSandbox(files);

  // Create convenience copies of top-level demo files
  try {
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
  } catch {
    // Best-effort file setup
  }

  return sandbox;
}

export async function POST(req: Request) {
  try {
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
  } catch (error) {
    console.error("[/api/exec] Error:", error);
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}
