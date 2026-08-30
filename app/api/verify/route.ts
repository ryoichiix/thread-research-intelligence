import type { NextRequest } from "next/server";
import { verifyPost } from "@/lib/api-handlers";
import { optionsResponse } from "@/lib/security";

export const POST = verifyPost;
export const OPTIONS = (request: NextRequest) => optionsResponse(request);
