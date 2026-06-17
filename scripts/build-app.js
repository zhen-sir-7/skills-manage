import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const root = process.cwd();
const electronDist = path.join(root, "node_modules", "electron", "dist");
const output = path.join(root, "release", "win-unpacked");
const appOutput = path.join(output, "resources", "app");
const iconPath = path.join(root, "public", "app.ico");
const exePath = path.join(output, "Skills 管理器.exe");
const rcedit = path.join(root, "node_modules", "rcedit", "bin", process.arch === "x64" ? "rcedit-x64.exe" : "rcedit.exe");
const execFileAsync = promisify(execFile);

await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(path.dirname(output), { recursive: true });
await writeIcon(iconPath);
await fs.cp(electronDist, output, { recursive: true });

await fs.rm(appOutput, { recursive: true, force: true });
await fs.mkdir(appOutput, { recursive: true });
await copy("electron", path.join(appOutput, "electron"));
await copy("public", path.join(appOutput, "public"));
await copy("src", path.join(appOutput, "src"));
await copy("package.json", path.join(appOutput, "package.json"));

await fs.rename(path.join(output, "electron.exe"), exePath);
await execFileAsync(rcedit, [exePath, "--set-icon", iconPath], { windowsHide: true });
console.log(`已构建：${exePath}`);

async function copy(source, destination) {
  await fs.cp(path.join(root, source), destination, { recursive: true });
}

async function writeIcon(filePath) {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const images = sizes.map(createBmpIconImage);
  const headerSize = 6 + images.length * 16;
  let offset = headerSize;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  images.forEach((image, index) => {
    const entry = 6 + index * 16;
    header[entry] = image.size === 256 ? 0 : image.size;
    header[entry + 1] = image.size === 256 ? 0 : image.size;
    header[entry + 2] = 0;
    header[entry + 3] = 0;
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(image.buffer.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += image.buffer.length;
  });

  await fs.writeFile(filePath, Buffer.concat([header, ...images.map((image) => image.buffer)]));
}

function createBmpIconImage(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const scale = size / 256;
  const rects = [
    [40, 40, 216, 52, 17, 17, 17, 255],
    [40, 204, 216, 216, 17, 17, 17, 255],
    [40, 40, 52, 216, 17, 17, 17, 255],
    [204, 40, 216, 216, 17, 17, 17, 255],
    [88, 88, 128, 128, 17, 17, 17, 255],
    [128, 128, 168, 168, 17, 17, 17, 255],
    [128, 60, 140, 88, 17, 17, 17, 255],
    [128, 168, 140, 196, 17, 17, 17, 255],
    [60, 128, 88, 140, 17, 17, 17, 255],
    [168, 128, 196, 140, 17, 17, 17, 255],
    [68, 68, 108, 80, 232, 75, 47, 255],
    [68, 68, 80, 108, 232, 75, 47, 255],
    [148, 176, 188, 188, 232, 75, 47, 255],
    [176, 148, 188, 188, 232, 75, 47, 255],
  ];

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sourceX = x / scale;
      const sourceY = y / scale;
      const color = pickColor(sourceX, sourceY, rects);
      const offset = ((size - 1 - y) * size + x) * 4;
      pixels[offset] = color[2];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[0];
      pixels[offset + 3] = color[3];
    }
  }

  const dib = Buffer.alloc(40);
  dib.writeUInt32LE(40, 0);
  dib.writeInt32LE(size, 4);
  dib.writeInt32LE(size * 2, 8);
  dib.writeUInt16LE(1, 12);
  dib.writeUInt16LE(32, 14);
  dib.writeUInt32LE(0, 16);
  dib.writeUInt32LE(pixels.length, 20);
  return { size, buffer: Buffer.concat([dib, pixels]) };
}

function pickColor(x, y, rects) {
  for (const rect of rects) {
    if (x >= rect[0] && y >= rect[1] && x < rect[2] && y < rect[3]) return rect.slice(4);
  }
  return [242, 240, 232, 255];
}
