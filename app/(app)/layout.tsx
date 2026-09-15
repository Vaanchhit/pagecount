import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Icon from "@/components/Icon";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, onboarded")
    .eq("id", user.id)
    .single();

  // New accounts get a provisional username from the signup trigger; send
  // them to pick a real one and hand us their timezone before anything logs.
  if (!profile?.onboarded) redirect("/onboarding");

  const { count: pending } = await supabase
    .from("friendships")
    .select("id", { count: "exact", head: true })
    .eq("addressee_id", user.id)
    .eq("status", "pending");

  const name = profile.display_name || profile.username;

  return (
    <div className="app">
      <nav className="nav">
        <Link className="brand" href="/library">
          <span className="logo-tile"><Icon name="book" size={16} /></span>
          Pagecount
        </Link>

        <div className="navlinks">
          <Link href="/library">Library</Link>
          <Link href="/feed">Friends</Link>
          <span className="has-count">
            <Link href="/friends">Requests</Link>
            {!!pending && <span className="count">{pending}</span>}
          </span>
        </div>

        <Link className="chip" href={`/u/${profile.username}`}>
          <span className="avatar">{name.slice(0, 2).toUpperCase()}</span>
          <span className="truncate" style={{ maxWidth: 120 }}>{name}</span>
        </Link>
      </nav>

      <main className="container shell">{children}</main>
    </div>
  );
}
