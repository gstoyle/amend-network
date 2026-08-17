import { Socket } from "node:net";
import { env } from "@/lib/env";

export const EICAR =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

export type ScanResult = "clean" | "infected" | "error";

const INSTREAM_CHUNK = 8192;
const CLAMD_TIMEOUT_MS = 30_000;

function scanDouble(bytes: Buffer): ScanResult {
  if (bytes.includes(Buffer.from(EICAR, "ascii"))) {
    return "infected";
  }
  return "clean";
}

function scanClamd(host: string, port: number, bytes: Buffer): Promise<ScanResult> {
  return new Promise((resolve) => {
    const socket = new Socket();
    let response = "";
    let settled = false;

    const finish = (result: ScanResult): void => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolve(result);
    };

    const timer = setTimeout(() => finish("error"), CLAMD_TIMEOUT_MS);

    socket.on("data", (chunk: Buffer) => {
      response += chunk.toString("utf8");
    });
    socket.on("error", () => finish("error"));
    socket.on("end", () => {
      const text = response.trim();
      if (/FOUND/i.test(text)) {
        finish("infected");
        return;
      }
      if (/\bOK\b/i.test(text)) {
        finish("clean");
        return;
      }
      finish("error");
    });

    socket.connect(port, host, () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < bytes.length; offset += INSTREAM_CHUNK) {
        const slice = bytes.subarray(offset, offset + INSTREAM_CHUNK);
        const header = Buffer.alloc(4);
        header.writeUInt32BE(slice.length, 0);
        socket.write(header);
        socket.write(slice);
      }
      const end = Buffer.alloc(4);
      end.writeUInt32BE(0, 0);
      socket.write(end);
    });
  });
}

export async function scanBytes(bytes: Buffer): Promise<ScanResult> {
  const settings = env();
  if (!settings.CLAMD_HOST) {
    return scanDouble(bytes);
  }
  try {
    return await scanClamd(settings.CLAMD_HOST, settings.CLAMD_PORT ?? 3310, bytes);
  } catch {
    return "error";
  }
}
