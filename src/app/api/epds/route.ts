import { NextResponse } from "next/server";
import { getEpds } from "@/server/epds/read-epds";

export async function GET() {
  const epds = await getEpds();

  return NextResponse.json({ epds });
}
