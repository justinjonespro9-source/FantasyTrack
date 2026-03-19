import bcrypt from "bcryptjs";
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/auth/login"
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          if (process.env.NODE_ENV === "development") {
            console.log("[auth] Missing email or password in credentials.", {
              hasEmail: Boolean(credentials?.email),
              hasPassword: Boolean(credentials?.password)
            });
          }
          return null;
        }

        const rawEmail = credentials.email;
        const normalizedEmail = rawEmail.toLowerCase().trim();

        const user = await prisma.user.findUnique({
          where: {
            email: normalizedEmail
          }
        });

        if (!user?.passwordHash) {
          console.log("[auth] User not found or missing passwordHash.", {
            rawEmail,
            normalizedEmail,
            found: Boolean(user)
          });
          return null;
        }

        if (user.isSuspended) {
          // Avoid account enumeration (still returns invalid credentials), but surface suspension message in UI.
          throw new Error("This account has been suspended.");
        }

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

        if (process.env.NODE_ENV === "development") {
          console.log("[auth] Credentials authorize result:", {
            rawEmail,
            normalizedEmail,
            found: Boolean(user),
            isValid
          });
        }

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          displayName: user.displayName,
          isAdmin: user.isAdmin
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.displayName = (user as { displayName?: string }).displayName ?? user.name ?? "User";
        token.isAdmin = (user as { isAdmin?: boolean }).isAdmin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.displayName = (token.displayName as string) ?? session.user.name ?? "User";
        session.user.isAdmin = Boolean(token.isAdmin);
      }
      return session;
    }
  }
};
