// src/main/utils/runCommand.ts
import { spawn } from "node:child_process";

export type CommandResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export function runCommand(
  cmd: string,
  args: string[],
  opts?: { timeoutMs?: number }
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      shell: process.platform === "win32", // helps PATH resolution on Windows
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));

    let killedByTimeout = false;
    const timeout = opts?.timeoutMs
      ? setTimeout(() => {
          killedByTimeout = true;
          child.kill("SIGKILL");
        }, opts.timeoutMs)
      : null;

    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      resolve({
        exitCode: killedByTimeout ? 124 : (code ?? 1),
        stdout,
        stderr,
      });
    });
  });
}
