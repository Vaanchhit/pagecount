"use server";

import { createClient } from "@/lib/supabase/server";
import { searchBooks as olSearch, type BookResult } from "@/lib/openlibrary";
import { revalidatePath } from "next/cache";

export async function searchBooks(query: string): Promise<BookResult[]> {
  return olSearch(query);
}

/**
 * Add a book to the shelf. Upserts into the global `books` catalogue first so
 * two people reading the same book share one row.
 */
export async function addToShelf(book: BookResult, status: "reading" | "want_to_read" = "reading") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: bookRow, error: bookErr } = await supabase
    .from("books")
    .upsert(
      {
        source: "openlibrary",
        source_id: book.sourceId,
        title: book.title,
        author: book.author,
        cover_url: book.coverUrl,
        total_pages: book.totalPages,
        isbn13: book.isbn13,
      },
      { onConflict: "source,source_id" }
    )
    .select("id")
    .single();

  if (bookErr || !bookRow) return { error: "Couldn't save that book" };

  const { error } = await supabase
    .from("user_books")
    .upsert(
      { user_id: user.id, book_id: bookRow.id, status, archived: false },
      { onConflict: "user_id,book_id" }
    );

  if (error) return { error: "That book is already on your shelf" };

  revalidatePath("/library");
  return { ok: true };
}

/**
 * Log progress.
 *
 * Takes the page you're *on*, not the pages you read — nobody knows the
 * second number off the top of their head. The delta is computed here from
 * your last position in this book. If the page went backwards (re-reading a
 * chapter) we record a single page rather than a negative, so the streak
 * still counts the day without inflating totals.
 */
export async function logProgress(userBookId: string, endPage: number, note?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  if (!Number.isFinite(endPage) || endPage < 1) {
    return { error: "Enter the page you're on" };
  }

  const { data: ub } = await supabase
    .from("user_books")
    .select("id, user_id, status, books(total_pages)")
    .eq("id", userBookId)
    .single();

  if (!ub || ub.user_id !== user.id) return { error: "Book not found" };

  const total = (ub.books as unknown as { total_pages: number | null })?.total_pages ?? null;
  if (total && endPage > total) {
    return { error: `That book is ${total} pages` };
  }

  const { data: last } = await supabase
    .from("reading_logs")
    .select("end_page")
    .eq("user_book_id", userBookId)
    .order("logged_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const previous = last?.end_page ?? 0;
  const delta = Math.max(1, endPage - previous);

  // local_date is resolved server-side from the user's stored timezone
  const { data: localDate } = await supabase.rpc("current_local_date", { uid: user.id });

  const { error } = await supabase.from("reading_logs").insert({
    user_id: user.id,
    user_book_id: userBookId,
    pages_read: delta,
    end_page: endPage,
    note: note?.trim() || null,
    local_date: localDate,
  });

  if (error) return { error: "Couldn't save that" };

  // Finish detection: reaching the last page offers to close the book out.
  const reachedEnd = total !== null && endPage >= total && ub.status !== "finished";

  revalidatePath("/library");
  revalidatePath(`/book/${userBookId}`);
  revalidatePath("/feed");

  return { ok: true, pagesRead: delta, reachedEnd };
}

export async function finishBook(userBookId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase
    .from("user_books")
    .update({ status: "finished", finished_at: new Date().toISOString() })
    .eq("id", userBookId)
    .eq("user_id", user.id);

  if (error) return { error: "Couldn't update that" };

  revalidatePath("/library");
  revalidatePath("/feed");
  return { ok: true };
}

export async function reopenBook(userBookId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  await supabase
    .from("user_books")
    .update({ status: "reading", finished_at: null })
    .eq("id", userBookId)
    .eq("user_id", user.id);

  revalidatePath("/library");
  return { ok: true };
}

/** Archive, never delete — the logs underneath are streak history. */
export async function archiveBook(userBookId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  await supabase
    .from("user_books")
    .update({ archived: true })
    .eq("id", userBookId)
    .eq("user_id", user.id);

  revalidatePath("/library");
  return { ok: true };
}
