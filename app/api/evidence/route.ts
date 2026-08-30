import type { NextRequest } from "next/server";
import { evidencePost } from "@/lib/api-handlers";
import { optionsResponse } from "@/lib/security";

export const POST = evidencePost;
export const OPTIONS = (request: NextRequest) => optionsResponse(request);
