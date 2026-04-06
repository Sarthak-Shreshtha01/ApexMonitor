import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/register', '/verify-email', '/forgot-password', '/reset-password'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  
  // As per SRS: Rely on lightweight HTTP-only auth_present cookie for middleware routing
  const authPresent = req.cookies.get('auth_present');

  // 1. If trying to access dashboard without auth -> Redirect to Login
//   if (!PUBLIC_PATHS.includes(pathname) && !authPresent) {
//     const loginUrl = req.nextUrl.clone();
//     loginUrl.pathname = '/login';
//     loginUrl.searchParams.set('redirect', pathname);
//     return NextResponse.redirect(loginUrl);
//   }

//   // 2. If trying to access Landing/Login while authenticated -> Redirect to Overview
//   if ((pathname === '/' || pathname === '/login') && authPresent) {
//     const overviewUrl = req.nextUrl.clone();
//     overviewUrl.pathname = '/overview';
//     return NextResponse.redirect(overviewUrl);
//   }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};