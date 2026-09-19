import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const SAFE_VALUE = /^[A-Za-z0-9,-]+$/;

export async function POST(request: NextRequest) {
  const device = request.nextUrl.searchParams.get("device") || "unknown";
  const locales = request.nextUrl.searchParams.get("locales") || "all";
  if (!SAFE_VALUE.test(device) || !SAFE_VALUE.test(locales)) {
    return NextResponse.json({ ok: false, error: "Invalid export name" }, { status: 400 });
  }

  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length === 0 || bytes.length > 300 * 1024 * 1024) {
    return NextResponse.json({ ok: false, error: "Invalid export size" }, { status: 400 });
  }

  const outputDir = path.resolve(
    process.cwd(),
    "..",
    "artifacts",
    "store-screenshots",
    "multilingual",
    "batches",
  );
  await mkdir(outputDir, { recursive: true });
  const localeSlug = locales.replace(/,/g, "-");
  const fileName = `fortale-ios-${device}-${localeSlug}.zip`;
  const outputPath = path.join(outputDir, fileName);
  await writeFile(outputPath, bytes);

  return NextResponse.json({ ok: true, path: outputPath, bytes: bytes.length });
}
