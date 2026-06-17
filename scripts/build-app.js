import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const electronDist = path.join(root, "node_modules", "electron", "dist");
const output = path.join(root, "release", "win-unpacked");
const appOutput = path.join(output, "resources", "app");

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.cp(electronDist, output, { recursive: true });

await fs.rm(appOutput, { recursive: true, force: true });
await fs.mkdir(appOutput, { recursive: true });
await copy("electron", path.join(appOutput, "electron"));
await copy("public", path.join(appOutput, "public"));
await copy("src", path.join(appOutput, "src"));
await copy("package.json", path.join(appOutput, "package.json"));

await fs.rename(path.join(output, "electron.exe"), path.join(output, "Skills 管理器.exe"));
console.log(`已构建：${path.join(output, "Skills 管理器.exe")}`);

async function copy(source, destination) {
  await fs.cp(path.join(root, source), destination, { recursive: true });
}
