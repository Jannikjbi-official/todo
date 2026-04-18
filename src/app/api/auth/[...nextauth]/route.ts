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
      console.log("[AUTH] SignIn attempt:", { user, profile: profile?.id });
      if (!profile) {
        console.error("[AUTH] No profile found in signIn callback");
        return false;
      }

      const discordId = profile.id;
      const ownerId = process.env.OWNER_DISCORD_ID;

      console.log("[AUTH] Discord ID:", discordId, "Owner ID:", ownerId);
      
      return true;
    },
    async session({ session, token }: any) {
      console.log("[AUTH] Session callback start:", { tokenSub: token.sub });
      if (session.user) {
        session.user.id = token.sub;
        session.user.discordId = token.discordId;
        
        try {
          // Fetch or create profile in Supabase
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (error && error.code !== 'PGRST116') {
            console.error("[AUTH] Supabase error fetching profile:", error);
          }

          if (profile) {
            console.log("[AUTH] Profile found:", profile.role);
            session.user.role = profile.role;
          } else {
            // Auto-promote owner
            const isOwner = token.discordId === process.env.OWNER_DISCORD_ID;
            const role = isOwner ? 'admin' : 'member';
            
            console.log("[AUTH] No profile found, creating one. Role:", role, "isOwner:", isOwner);
            
            const { error: upsertError } = await supabase.from('profiles').upsert({
              id: session.user.id,
              name: session.user.name,
              email: session.user.email,
              role: role
            });
            
            if (upsertError) {
              console.error("[AUTH] Error creating profile:", upsertError);
            }
            
            session.user.role = role;
          }
        } catch (err) {
          console.error("[AUTH] Unexpected error in session callback:", err);
        }
      }
      console.log("[AUTH] Session callback end:", session.user?.role);
      return session;
    },
    async jwt({ token, profile, account }) {
      if (profile) {
        console.log("[AUTH] JWT callback - profile found:", (profile as any).id);
        token.discordId = (profile as any).id;
      }
      return token;
    },
  },
  debug: true,
  pages: {
    signIn: '/login',
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
