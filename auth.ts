/**
 * NextAuth config. Required env: AUTH_SECRET (or NEXTAUTH_SECRET), and for Google:
 * GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET. Optional: AUTH_URL / NEXTAUTH_URL for production.
 */
import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { clearRateLimit, consumeRateLimit, requestClientAddress } from "@/lib/security/rate-limit";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? [Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })] : []),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || typeof credentials.email !== "string")
          return null;
        const email = credentials.email.trim().toLowerCase();
        const password =
          typeof credentials.password === "string" ? credentials.password : "";
        const [emailLimit, addressLimit] = await Promise.all([
          consumeRateLimit("auth-login-email", email, { limit: 10, windowMs: 15 * 60_000 }),
          consumeRateLimit("auth-login-address", requestClientAddress(request.headers), { limit: 50, windowMs: 15 * 60_000 }),
        ]);
        if (!emailLimit.allowed || !addressLimit.allowed) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.password) return null;
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;
        await clearRateLimit("auth-login-email", email);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatar ?? null,
        };
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request }) {
      const userId = auth?.user?.id;
      const isLoggedIn = typeof userId === "string" && userId.length > 0;
      const isAuthPage =
        request.nextUrl.pathname === "/login" ||
        request.nextUrl.pathname === "/register";
      if (isAuthPage && isLoggedIn)
        return Response.redirect(new URL("/dashboard", request.nextUrl));
      if (!isLoggedIn && !isAuthPage) return false;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id ?? token.sub) as string;
      }
      return session;
    },
  },
});
