import { promises as fs } from "node:fs";
import path from "node:path";
import { epdSchema, type Epd } from "@/shared/epd/schema";

export async function getEpds(): Promise<Epd[]> {
  const dataDir = path.join(process.cwd(), "data");
  const files = (await fs.readdir(dataDir))
    .filter((file) => file.endsWith(".json"))
    .sort();

  const epds = await Promise.all(
    files.map(async (file) => {
      const json = JSON.parse(await fs.readFile(path.join(dataDir, file), "utf8"));
      return epdSchema.parse(json);
    })
  );

  return epds;
}
