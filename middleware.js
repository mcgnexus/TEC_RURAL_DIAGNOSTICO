import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC_ROUTES = ['/', '/login', '/register', '/reset-password'];

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const requiresAuth = pathname.startsWith('/dashboard');
  const requiresAdmin = pathname.startsWith('/dashboard/admin');

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session && requiresAuth) {
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('reason', 'auth');
    return NextResponse.redirect(redirectUrl);
  }

  let role = null;
  if (session) {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    role = data?.role || null;
  }

  if (requiresAdmin && role !== 'admin') {
    const redirectUrl = new URL('/dashboard', request.url);
    redirectUrl.searchParams.set('error', 'no-admin');
    return NextResponse.redirect(redirectUrl);
  }

  if (session && PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|public).*)'],
};
