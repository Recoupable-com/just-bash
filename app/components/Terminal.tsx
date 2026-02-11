"use client";

import { useEffect, useRef } from "react";
import {
  CMD_ABOUT,
  CMD_INSTALL,
  CMD_GITHUB,
} from "./terminal-content";
import {
  createAgentHandler,
  createInputHandler,
  showWelcome,
} from "./terminal-parts";
import { LiteTerminal } from "./lite-terminal";

function getTheme(isDark: boolean) {
  return {
    background: isDark ? "#000" : "#fff",
    foreground: isDark ? "#e0e0e0" : "#1a1a1a",
    cursor: isDark ? "#fff" : "#000",
    cyan: isDark ? "#0AC5B3" : "#089485",
    brightCyan: isDark ? "#3DD9C8" : "#067A6D",
    brightBlack: isDark ? "#666" : "#525252",
  };
}

type ExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

// Static commands handled client-side (no sandbox needed)
const staticCommands: Record<string, () => ExecResult> = {
  about: () => ({ stdout: CMD_ABOUT, stderr: "", exitCode: 0 }),
  install: () => ({ stdout: CMD_INSTALL, stderr: "", exitCode: 0 }),
  github: () => ({ stdout: CMD_GITHUB, stderr: "", exitCode: 0 }),
};

export default function TerminalComponent({
  getAccessToken,
}: {
  getAccessToken: () => Promise<string | null>;
}) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = terminalRef.current;
    if (!container) return;

    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    const term = new LiteTerminal({
      cursorBlink: true,
      theme: getTheme(isDark),
    });
    term.open(container);

    // Agent handler
    const agentHandler = createAgentHandler(term, getAccessToken);

    // Sandbox session ID (persisted across commands)
    let sandboxId: string | null = null;

    // Unified exec function - all commands go through sandbox
    const exec = async (command: string): Promise<ExecResult> => {
      const trimmed = command.trim();
      const firstWord = trimmed.split(/\s+/)[0];

      // Static commands (about, install, github) - no sandbox needed
      if (firstWord in staticCommands) {
        return staticCommands[firstWord]();
      }

      // Agent command - uses its own API endpoint
      if (firstWord === "agent") {
        let prompt = trimmed.slice(5).trim();
        // Strip surrounding quotes
        if (
          (prompt.startsWith('"') && prompt.endsWith('"')) ||
          (prompt.startsWith("'") && prompt.endsWith("'"))
        ) {
          prompt = prompt.slice(1, -1);
        }
        return agentHandler(prompt);
      }

      // All other commands → sandbox
      const token = await getAccessToken();
      if (!token) {
        return {
          stdout: "",
          stderr: "Error: Not authenticated. Please log in and try again.\n",
          exitCode: 1,
        };
      }

      try {
        const res = await fetch("/api/exec", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ command: trimmed, sandboxId }),
        });

        if (!res.ok) {
          return {
            stdout: "",
            stderr: `Error: ${res.status} ${res.statusText}\n`,
            exitCode: 1,
          };
        }

        const result = await res.json();
        if (result.sandboxId) {
          sandboxId = result.sandboxId;
        }
        return {
          stdout: result.stdout || "",
          stderr: result.stderr || "",
          exitCode: result.exitCode ?? 0,
        };
      } catch (error) {
        return {
          stdout: "",
          stderr: `Error: ${error instanceof Error ? error.message : "Unknown error"}\n`,
          exitCode: 1,
        };
      }
    };

    // Set up input handling with unified exec
    const inputHandler = createInputHandler(term, exec);

    // Track cleanup state
    let disposed = false;

    // Show welcome and handle ?agent= query parameter
    requestAnimationFrame(() => {
      if (disposed) return;

      showWelcome(term);

      // Check for ?agent= query parameter
      const params = new URLSearchParams(window.location.search);
      const agentQuery = params.get("agent");

      if (agentQuery) {
        // Clean the URL
        window.history.replaceState({}, "", window.location.pathname);
        // Execute the agent command
        void inputHandler.executeCommand(`agent "${agentQuery}"`);
      } else if (inputHandler.history.length === 0) {
        // Pre-populate command if history is empty and no query param
        inputHandler.setInitialCommand('agent "What is just-bash?"');
      }
    });

    // Color scheme change handling
    const colorSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onColorSchemeChange = (e: MediaQueryListEvent) => {
      term.options.theme = getTheme(e.matches);
    };
    colorSchemeQuery.addEventListener("change", onColorSchemeChange);

    // Initial focus
    term.focus();

    return () => {
      disposed = true;
      colorSchemeQuery.removeEventListener("change", onColorSchemeChange);
      term.dispose();
    };
  }, [getAccessToken]);

  return (
    <div
      ref={terminalRef}
      style={{
        padding:
          "calc(16px + env(safe-area-inset-top, 0px)) calc(16px + env(safe-area-inset-right, 0px)) 16px calc(16px + env(safe-area-inset-left, 0px))",
        boxSizing: "border-box",
      }}
    />
  );
}
