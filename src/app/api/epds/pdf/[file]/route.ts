import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{
    file: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { file } = await context.params;
  const filename = decodeURIComponent(file);

  if (!filename.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json({ error: "Invalid PDF filename." }, { status: 400 });
  }

  // If the filename starts with the resources prefix, strip it to prevent nested resolution
  let cleanFilename = filename;
  if (filename.toLowerCase().startsWith("resources/")) {
    cleanFilename = filename.substring("resources/".length);
  } else if (filename.toLowerCase().startsWith("resources\\")) {
    cleanFilename = filename.substring("resources\\".length);
  }

  const resourcesDir = path.resolve(process.cwd(), "Resources");
  const pdfPath = path.resolve(resourcesDir, cleanFilename);

  // Prevent directory traversal: ensure resolved path stays within Resources/
  if (!pdfPath.startsWith(resourcesDir + path.sep) && pdfPath !== resourcesDir) {
    return NextResponse.json({ error: "Invalid PDF filename." }, { status: 400 });
  }

  try {
    const pdf = await fs.readFile(pdfPath);

    return new NextResponse(pdf, {
      headers: {
        "Content-Disposition": `inline; filename="${filename.replaceAll('"', "")}"`,
        "Content-Type": "application/pdf"
      }
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (code === "ENOENT") {
      return NextResponse.json({ error: "PDF not found." }, { status: 404 });
    }

    throw error;
  }
}
