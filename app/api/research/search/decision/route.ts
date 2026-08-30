import type { NextRequest } from "next/server";
import { researchSearchDecisionPost } from "@/lib/api-handlers";
import { optionsResponse } from "@/lib/security";

export const POST = researchSearchDecisionPost;
export const OPTIONS = (request: NextRequest) => optionsResponse(request);
