import { spawn } from "node:child_process";

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [
  spawn(npm, ["run", "dev:web"], { stdio: "inherit" }),
  spawn(npm, ["run", "dev:canvas"], { stdio: "inherit" }),
];

let shuttingDown = false;
function stopAll(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
  process.exitCode = code;
}

for (const child of children) {
  child.on("error", () => stopAll(1));
  child.on("exit", (code, signal) => {
    if (!shuttingDown && (code !== 0 || signal)) stopAll(code ?? 1);
  });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
