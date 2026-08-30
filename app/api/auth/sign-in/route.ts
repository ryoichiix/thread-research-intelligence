import type { NextRequest } from "next/server";
import { authPost } from "@/lib/api-handlers";

export async function POST(request: NextRequest) {
  return authPost(request, "sign-in");
}
