/**
 * Open Library lookup.
 *
 * Free, no API key. Covers are served from a separate host, not inline in the
 * search response. Open Library is a non-profit and doesn't publish formal
 * rate limits, so we search there once and then write the result into our own
 * `books` table — after a book's first use it's served entirely from Postgres.
 */

export type BookResult = {
  sourceId: string;      // '/works/OL45804W'
  title: string;
  author: string | null;
  coverUrl: string | null;
  totalPages: number | null;
  isbn13: string | null;
};

type OLDoc = {
  key: string;
  title: string;
  author_name?: string[];
  cover_i?: number;
  number_of_pages_median?: number;
  isbn?: string[];
};

const SEARCH = "https://openlibrary.org/search.json";
const COVER = "https://covers.openlibrary.org/b/id";

export function coverUrl(id: number, size: "S" | "M" | "L" = "M") {
  return `${COVER}/${id}-${size}.jpg`;
}

export async function searchBooks(query: string, limit = 12): Promise<BookResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const params = new URLSearchParams({
    q,
    limit: String(limit),
    fields: "key,title,author_name,cover_i,number_of_pages_median,isbn",
  });

  const res = await fetch(`${SEARCH}?${params}`, {
    headers: { "User-Agent": "pagecount/0.1 (reading tracker)" },
    // Open Library results are stable; cache hard to stay a good citizen.
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!res.ok) return [];

  const data = (await res.json()) as { docs?: OLDoc[] };

  return (data.docs ?? [])
    .filter((d) => d.key && d.title)
    .map((d) => ({
      sourceId: d.key,
      title: d.title,
      author: d.author_name?.[0] ?? null,
      coverUrl: d.cover_i ? coverUrl(d.cover_i) : null,
      totalPages: d.number_of_pages_median ?? null,
      isbn13: d.isbn?.find((i) => i.length === 13) ?? null,
    }));
}
