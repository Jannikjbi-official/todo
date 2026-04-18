import NextAuth, { NextAuthOptions } from "next-auth";
import DiscordProvider from "next-auth/providers/discord";
import { supabase } from "@/lib/supabase";

export const authOptions: NextAuthOptions = {
  providers: [
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: { params: { scope: 'identify email' } },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }: any) {
      if (!profile) return false;

      const discordId = profile.id;
      const ownerId = process.env.OWNER_DISCORD_ID;

      // Access Control: Only specific users allowed (or everyone if you want, but here we mirror the original logic)
      // In the original, anyone could login but only owner got admin. 
      // If the user wants strict access, we can restrict here.
      // For now, let's allow login but handle roles in session.
      
      return true;
    },
    async session({ session, token }: any) {
      if (session.user) {
        session.user.id = token.sub;
        session.user.discordId = token.discordId;
        
        // Fetch or create profile in Supabase
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          session.user.role = profile.role;
        } else {
          // Auto-promote owner
          const isOwner = token.discordId === process.env.OWNER_DISCORD_ID;
          const role = isOwner ? 'admin' : 'member';
          
          await supabase.from('profiles').upsert({
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            role: role
          });
          
          session.user.role = role;
        }
      }
      return session;
    },
    async jwt({ token, profile, account }) {
      if (profile) {
        token.discordId = (profile as any).id;
      }
      return token;
    },
  },
  pages: {
    signIn: '/login',
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
