const { spawn, spawnSync } = require("node:child_process");

const isWindows = process.platform === "win32";

const allCommands = [
  {
    name: "api",
    args: ["--filter", "@my-ecom/api", "dev"]
  },
  {
    name: "web",
    args: ["--filter", "@my-ecom/web", "dev"]
  }
];
const selectedTargets = new Set(
  (process.env.DEV_TARGETS ?? allCommands.map((command) => command.name).join(","))
    .split(",")
    .map((target) => target.trim())
    .filter(Boolean)
);
const commands = allCommands.filter((command) => selectedTargets.has(command.name));

const children = new Map();
let shuttingDown = false;
let stdinRawMode = false;

function killTree(pid) {
  if (!pid) return;

  if (isWindows) {
    spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], {
      stdio: "ignore"
    });
    return;
  }

  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // The child may already have exited.
    }
  }
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  restoreStdin();

  for (const child of children.values()) {
    killTree(child.pid);
  }

  process.exit(exitCode);
}

for (const command of commands) {
  const child = spawn("pnpm", command.args, {
    detached: !isWindows,
    shell: isWindows,
    stdio: ["ignore", "inherit", "inherit"]
  });

  children.set(command.name, child);

  child.on("error", (error) => {
    console.error(`${command.name} dev process failed to start.`);
    console.error(error);
    shutdown(1);
  });

  child.on("exit", (code, signal) => {
    children.delete(command.name);

    if (shuttingDown) return;

    if (code !== 0) {
      console.error(`${command.name} dev process exited with code ${code ?? signal}.`);
      shutdown(code ?? 1);
      return;
    }

    if (children.size === 0) {
      shutdown(0);
    }
  });
}

if (commands.length === 0) {
  console.error("No dev targets selected.");
  process.exit(1);
}

function restoreStdin() {
  if (!stdinRawMode) return;

  process.stdin.setRawMode(false);
  stdinRawMode = false;
}

if (process.stdin.readable) {
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    stdinRawMode = true;
  }

  process.stdin.resume();
  process.stdin.on("data", (data) => {
    if (data.includes(3)) {
      shutdown(0);
    }
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
process.on("SIGHUP", () => shutdown(0));
process.on("exit", () => {
  restoreStdin();

  if (shuttingDown) return;

  for (const child of children.values()) {
    killTree(child.pid);
  }
});
