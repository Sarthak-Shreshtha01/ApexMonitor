import { NextRequest, NextResponse } from 'next/server';
import { PUBLIC_PATHS } from '@/shared/routes/routes';

const isPublicPath = (path: string) => (PUBLIC_PATHS as readonly string[]).includes(path);

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};