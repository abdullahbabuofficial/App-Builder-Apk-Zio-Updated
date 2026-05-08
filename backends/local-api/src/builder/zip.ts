/**
 * Minimal wrapper around `archiver` that turns an in-memory file list into a
 * zip file on disk. Used by the WebView builder runner — we don't need the
 * full archiver API surface, just a single "write these entries to this path
 * rooted under that prefix" call.
 */

import { createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import archiver from "archiver";

export type ZipEntry = {
  /** Forward-slash, project-relative path. */
  path: string;
  content: Buffer;
};

export type ZipResult = {
  outputPath: string;
  size: number;
};

/**
 * Write the given entries to `outputPath`. If `rootPrefix` is provided, every
 * entry will be nested under it inside the zip — handy when the user expects
 * a single top-level folder when they unzip.
 */
export async function writeZip(
  entries: ZipEntry[],
  outputPath: string,
  rootPrefix?: string,
): Promise<ZipResult> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  return await new Promise<ZipResult>((resolve, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    let settled = false;

    const finish = (size: number) => {
      if (settled) return;
      settled = true;
      resolve({ outputPath, size });
    };
    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    output.on("close", () => finish(archive.pointer()));
    output.on("error", fail);
    archive.on("warning", (err: Error | NodeJS.ErrnoException) => {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      fail(err);
    });
    archive.on("error", fail);

    archive.pipe(output);
    const prefix = rootPrefix ? rootPrefix.replace(/\/+$/, "") + "/" : "";
    for (const entry of entries) {
      const name = `${prefix}${entry.path}`.replace(/\\/g, "/");
      archive.append(entry.content, { name });
    }
    archive.finalize().catch(fail);
  });
}
