// BioRxiv API integration for pulling recent papers
// Docs: https://api.biorxiv.org

export interface BiorxivPaper {
  doi: string;
  title: string;
  authors: string;
  abstract: string;
  date: string;
  category: string;
}

export async function fetchRecentPapers(
  days: number = 3,
  limit: number = 10
): Promise<BiorxivPaper[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const url = `https://api.biorxiv.org/details/biorxiv/${fmt(startDate)}/${fmt(endDate)}/0/json`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error(`BioRxiv API error: ${res.status}`);
    return [];
  }

  const data = await res.json();
  const papers: BiorxivPaper[] = (data.collection || [])
    .slice(0, limit)
    .map(
      (p: {
        doi: string;
        title: string;
        authors: string;
        abstract: string;
        date: string;
        category: string;
      }) => ({
        doi: p.doi,
        title: p.title,
        authors: p.authors,
        abstract: p.abstract,
        date: p.date,
        category: p.category,
      })
    );

  return papers;
}
