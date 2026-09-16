import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FriendManager from "@/components/FriendManager";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  status: "pending" | "accepted";
  requester_id: string;
  addressee_id: string;
  requester: { username: string; display_name: string | null } | null;
  addressee: { username: string; display_name: string | null } | null;
};

export default async function FriendsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("friendships")
    .select("id, status, requester_id, addressee_id, requester:requester_id(username, display_name), addressee:addressee_id(username, display_name)")
    .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);

  const all = (rows ?? []) as unknown as Row[];
  const other = (r: Row) => (r.requester_id === user.id ? r.addressee : r.requester);
  const shape = (r: Row) => ({
    id: r.id,
    name: other(r)?.display_name || other(r)?.username || "Someone",
    username: other(r)?.username ?? "",
  });

  const incoming = all.filter((r) => r.status === "pending" && r.addressee_id === user.id);
  const outgoing = all.filter((r) => r.status === "pending" && r.requester_id === user.id);
  const friends = all.filter((r) => r.status === "accepted");

  return (
    <div className="shell__main" style={{ maxWidth: 560 }}>
      <section>
        <h1 className="page-title mb-md">Find friends</h1>
        <FriendManager />
      </section>

      {incoming.length > 0 && (
        <section>
          <h2 className="page-title mb-md" style={{ fontSize: 16 }}>Wants to be friends</h2>
          <FriendManager mode="requests" requests={incoming.map(shape)} />
        </section>
      )}

      {friends.length > 0 && (
        <section>
          <div className="between mb-md">
            <h2 className="page-title" style={{ fontSize: 16 }}>Friends</h2>
            <span className="badge num">{friends.length}</span>
          </div>
          <FriendManager mode="list" requests={friends.map(shape)} />
        </section>
      )}

      {outgoing.length > 0 && (
        <section>
          <h2 className="page-title mb-md" style={{ fontSize: 16 }}>Waiting to hear back</h2>
          <FriendManager mode="outgoing" requests={outgoing.map(shape)} />
        </section>
      )}
    </div>
  );
}
