import { describe, expect, it } from "vitest";
import { BashEnv } from "../../BashEnv.js";

describe("alias command", () => {
  it("should list no aliases initially", async () => {
    const env = new BashEnv();
    const result = await env.exec("alias");
    expect(result.stdout).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("should set and list an alias", async () => {
    const env = new BashEnv();
    await env.exec("alias ll='ls -la'");
    const result = await env.exec("alias");
    expect(result.stdout).toContain("alias ll='ls -la'");
    expect(result.exitCode).toBe(0);
  });

  it("should show a specific alias", async () => {
    const env = new BashEnv();
    await env.exec("alias ll='ls -la'");
    const result = await env.exec("alias ll");
    expect(result.stdout).toBe("alias ll='ls -la'\n");
    expect(result.exitCode).toBe(0);
  });

  it("should error when alias not found", async () => {
    const env = new BashEnv();
    const result = await env.exec("alias notexists");
    expect(result.stderr).toContain("not found");
    expect(result.exitCode).toBe(1);
  });

  it("should set multiple aliases", async () => {
    const env = new BashEnv();
    await env.exec("alias ll='ls -la' la='ls -a'");
    const result = await env.exec("alias");
    expect(result.stdout).toContain("alias ll='ls -la'");
    expect(result.stdout).toContain("alias la='ls -a'");
  });

  it("should show help with --help", async () => {
    const env = new BashEnv();
    const result = await env.exec("alias --help");
    expect(result.stdout).toContain("alias");
    expect(result.exitCode).toBe(0);
  });
});

describe("unalias command", () => {
  it("should remove an alias", async () => {
    const env = new BashEnv();
    await env.exec("alias ll='ls -la'");
    await env.exec("unalias ll");
    const result = await env.exec("alias ll");
    expect(result.stderr).toContain("not found");
    expect(result.exitCode).toBe(1);
  });

  it("should error when unaliasing non-existent alias", async () => {
    const env = new BashEnv();
    const result = await env.exec("unalias notexists");
    expect(result.stderr).toContain("not found");
    expect(result.exitCode).toBe(1);
  });

  it("should remove all aliases with -a", async () => {
    const env = new BashEnv();
    await env.exec("alias ll='ls -la' la='ls -a'");
    await env.exec("unalias -a");
    const result = await env.exec("alias");
    expect(result.stdout).toBe("");
    expect(result.exitCode).toBe(0);
  });

  it("should show help with --help", async () => {
    const env = new BashEnv();
    const result = await env.exec("unalias --help");
    expect(result.stdout).toContain("unalias");
    expect(result.exitCode).toBe(0);
  });
});
