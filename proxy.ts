import { auth } from "@/auth";
import { NextResponse } from "next/server";

const authProxy = auth((req) => {
  if (req.nextUrl.pathname.startsWith("/feedback") && !req.auth) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
});

export const proxy = authProxy;
export default authProxy;

export const config = {
  matcher: ["/feedback/:path*"],
};
