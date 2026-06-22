/**
 * NextAuth configuration — Credentials Provider
 *
 * Single-user auth backed by env vars:
 *   APP_USERNAME — login username (default: piaoshu)
 *   APP_PASSWORD — login password (default: Gai69999)
 *   NEXTAUTH_SECRET — JWT signing secret
 *   NEXTAUTH_URL — app origin
 *
 * Session strategy: JWT (stateless, 30-day expiry)
 * Login page: /login
 */
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

function getAppUsername(): string {
  return process.env.APP_USERNAME?.trim() || "piaoshu";
}

function getAppPassword(): string {
  return process.env.APP_PASSWORD?.trim() || "Gai69999";
}

function getSecret(): string {
  const configured = process.env.NEXTAUTH_SECRET?.trim();
  if (configured) return configured;
  const fallback = `avatar-agent:${getAppUsername()}:${getAppPassword()}`;
  return fallback;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "用户名", type: "text", placeholder: "piaoshu" },
        password: { label: "密码", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }
        const validUser = getAppUsername();
        const validPass = getAppPassword();
        const userOk =
          credentials.username.length === validUser.length &&
          credentials.username === validUser;
        const passOk =
          credentials.password.length === validPass.length &&
          credentials.password === validPass;
        if (userOk && passOk) {
          return {
            id: "1",
            name: credentials.username,
            email: `${credentials.username}@local`,
            image: null,
          };
        }
        await new Promise((r) => setTimeout(r, 500));
        return null;
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
  },
  jwt: {
    maxAge: SESSION_MAX_AGE,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: getSecret(),
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.name = user.name || token.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name || session.user.name;
      }
      return session;
    },
  },
  debug: false,
};
