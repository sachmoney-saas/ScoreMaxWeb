import { spawn, spawnSync } from "node:child_process";

const DEFAULT_PORT = 5000;

function parsePort(rawValue: string | undefined): number {
  const parsed = Number.parseInt(rawValue ?? String(DEFAULT_PORT), 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    return DEFAULT_PORT;
  }

  return parsed;
}

function parsePidLines(output: string): number[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => Number.parseInt(line, 10))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

function parsePidsFromFuser(output: string): number[] {
  const matches = output.match(/\b\d+\b/g) ?? [];
  return matches
    .map((value) => Number.parseInt(value, 10))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

function parsePidsFromNetstat(output: string, targetPort: number): number[] {
  const pids = new Set<number>();

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("TCP")) {
      continue;
    }

    const parts = line.split(/\s+/);
    if (parts.length < 5) {
      continue;
    }

    const localAddress = parts[1];
    const pidCandidate = parts[parts.length - 1];
    const separatorIndex = localAddress.lastIndexOf(":");
    if (separatorIndex < 0) {
      continue;
    }

    const port = Number.parseInt(localAddress.slice(separatorIndex + 1), 10);
    const pid = Number.parseInt(pidCandidate, 10);

    if (port === targetPort && Number.isInteger(pid) && pid > 0) {
      pids.add(pid);
    }
  }

  return [...pids];
}

function findPidsOnWindows(targetPort: number): number[] {
  const psCommand = `
$ErrorActionPreference = "SilentlyContinue"
Get-NetTCPConnection -State Listen -LocalPort ${targetPort} |
  Select-Object -ExpandProperty OwningProcess -Unique
`;

  const powershellResult = spawnSync(
    "powershell",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psCommand],
    { encoding: "utf8" },
  );

  const powershellPids = parsePidLines(powershellResult.stdout || "");
  if (powershellPids.length > 0) {
    return powershellPids;
  }

  const netstatResult = spawnSync("netstat", ["-ano", "-p", "tcp"], {
    encoding: "utf8",
  });

  return parsePidsFromNetstat(netstatResult.stdout || "", targetPort);
}

function findPidsOnUnix(targetPort: number): number[] {
  const lsofResult = spawnSync(
    "lsof",
    ["-ti", `TCP:${targetPort}`, "-sTCP:LISTEN"],
    { encoding: "utf8" },
  );

  const lsofPids = parsePidLines(lsofResult.stdout || "");
  if (lsofPids.length > 0) {
    return lsofPids;
  }

  const fuserResult = spawnSync("fuser", ["-n", "tcp", String(targetPort)], {
    encoding: "utf8",
  });

  const combined = `${fuserResult.stdout || ""} ${fuserResult.stderr || ""}`;
  return parsePidsFromFuser(combined);
}

function findPidsOnPort(targetPort: number): number[] {
  if (process.platform === "win32") {
    return findPidsOnWindows(targetPort);
  }

  return findPidsOnUnix(targetPort);
}

function uniquePids(pids: number[]): number[] {
  return [...new Set(pids)].filter((pid) => pid !== process.pid);
}

function killPidWindows(pid: number): boolean {
  const result = spawnSync("taskkill", ["/F", "/T", "/PID", String(pid)], {
    stdio: "ignore",
  });

  return result.status === 0;
}

function killPidUnix(pid: number, signal: NodeJS.Signals): boolean {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

async function freePort(targetPort: number): Promise<void> {
  const initialPids = uniquePids(findPidsOnPort(targetPort));
  if (initialPids.length === 0) {
    return;
  }

  console.log(
    `[dev] Port ${targetPort} in use by PID(s): ${initialPids.join(", ")}`,
  );

  if (process.platform === "win32") {
    const killed = initialPids.filter((pid) => killPidWindows(pid));
    if (killed.length > 0) {
      console.log(`[dev] Killed PID(s): ${killed.join(", ")}`);
    }
    return;
  }

  const terminated = initialPids.filter((pid) => killPidUnix(pid, "SIGTERM"));
  if (terminated.length > 0) {
    console.log(`[dev] Sent SIGTERM to PID(s): ${terminated.join(", ")}`);
  }

  await new Promise((resolve) => setTimeout(resolve, 250));

  const remaining = uniquePids(findPidsOnPort(targetPort));
  if (remaining.length > 0) {
    const forceKilled = remaining.filter((pid) => killPidUnix(pid, "SIGKILL"));
    if (forceKilled.length > 0) {
      console.log(`[dev] Sent SIGKILL to PID(s): ${forceKilled.join(", ")}`);
    }
  }
}

async function runDev(): Promise<void> {
  const port = parsePort(process.env.PORT);
  await freePort(port);

  const child = spawn("bun", ["--watch", "server/index.ts"], {
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || "development",
    },
    shell: process.platform === "win32",
  });

  const stopChild = () => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  };

  process.on("SIGINT", stopChild);
  process.on("SIGTERM", stopChild);

  child.on("error", (error) => {
    console.error("[dev] Failed to start Bun watcher:", error);
    process.exit(1);
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.exit(1);
      return;
    }

    process.exit(code ?? 0);
  });
}

runDev().catch((error) => {
  console.error("[dev] Unable to prepare dev server:", error);
  process.exit(1);
});
