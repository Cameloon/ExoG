import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadId } from "@/lib/uploads";

afterEach(() => vi.unstubAllGlobals());

describe("uploadId", () => {
  it("uses crypto.randomUUID when available", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "abc-123" });
    expect(uploadId()).toBe("abc-123");
  });

  it("falls back to getRandomValues on insecure origins", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(7);
        return bytes;
      },
    });
    // UUID v4 bits are set at byte 6 (version) and byte 8 (variant).
    expect(uploadId()).toBe("07070707070747078707070707070707");
  });
});
