import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      discordId: string;
    } & DefaultSession["user"];
  }

  interface User {
    role: string;
    discordId: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: string;
    discordId: string;
  }
}
