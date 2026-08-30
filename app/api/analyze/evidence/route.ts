import type { NextRequest } from "next/server";
import { analyzeEvidencePost } from "@/lib/api-handlers";
import { optionsResponse } from "@/lib/security";

export const POST = analyzeEvidencePost;
export const OPTIONS = (request: NextRequest) => optionsResponse(request);
