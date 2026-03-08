import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function parseJSON(raw: string | null | undefined, fallback: unknown = {}) {
  if (!raw) return fallback;
  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

export async function extractPaperClaims(abstract: string, title: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a scientific research analyst. Extract structured information from papers.",
      },
      {
        role: "user",
        content: `Read this paper and extract the information requested.

Title: ${title}
Abstract: ${abstract}

Return a JSON object with:
- "claims": The key scientific claim(s) made in this paper (2-3 sentences)
- "research_gap": What unanswered question or gap remains (1-2 sentences)

Return ONLY the JSON, no markdown.`,
      },
    ],
    temperature: 0.3,
  });

  return parseJSON(response.choices[0].message.content);
}

export async function generateStudy(paper: {
  title: string;
  abstract: string;
  claims: string;
  research_gap: string;
  category?: string;
}) {
  const categoryHint = paper.category
    ? `\nSource Subject Area: ${paper.category}\nIMPORTANT: Use the source subject area above as the primary signal for choosing tags. Only pick tags that genuinely match the paper's field.`
    : "";

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a principal investigator designing follow-up studies. Be specific and practical.",
      },
      {
        role: "user",
        content: `Given this scientific paper, propose a follow-up study.

Title: ${paper.title}
Abstract: ${paper.abstract}
Key Claims: ${paper.claims}
Research Gap: ${paper.research_gap}${categoryHint}

Return a JSON object with:
- "title": A concise study title (under 80 chars)
- "hypothesis": The specific hypothesis to test (1-2 sentences)
- "study_design": A detailed study design description (2-4 sentences)
- "funding_goal": Estimated cost in USD (number, between 5000 and 100000)
- "tags": An array of 1-3 scientific field tags from this list ONLY: "Neuroscience", "Molecular Biology", "Genetics", "Immunology", "Oncology", "Microbiology", "Pharmacology", "Bioinformatics", "Cell Biology", "Ecology", "Biochemistry", "Bioengineering", "Epidemiology", "Physiology", "Developmental Biology", "Evolutionary Biology", "Plant Biology", "Systems Biology", "Scientific Communication", "Zoology", "Paleontology", "Climate Science", "Psychology"

Pick ONLY tags that accurately describe the paper's actual field. Do NOT force-fit unrelated fields.

Return ONLY the JSON, no markdown.`,
      },
    ],
    temperature: 0.7,
  });

  return parseJSON(response.choices[0].message.content);
}

export async function decomposeStudy(study: {
  title: string;
  hypothesis: string;
  study_design: string;
}) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a principal investigator breaking studies into modular experiments for distributed labs.",
      },
      {
        role: "user",
        content: `Break this study into 3-5 modular experiments that different labs could independently perform.

Title: ${study.title}
Hypothesis: ${study.hypothesis}
Study Design: ${study.study_design}

Return a JSON array of experiments, each with:
- "module_name": Short name (e.g. "Cell Culture Assay")
- "description": What needs to be done (2-3 sentences)
- "expertise_required": What expertise a lab needs (e.g. "Molecular biology, cell culture")

Return ONLY the JSON array, no markdown.`,
      },
    ],
    temperature: 0.5,
  });

  return parseJSON(response.choices[0].message.content, []);
}

export async function generateSamples(module: {
  module_name: string;
  description: string;
  expertise_required: string;
  study_title: string;
  study_design: string;
}) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a lab manager creating a sample processing list for a research module. Generate realistic, specific samples that a lab would need to process.",
      },
      {
        role: "user",
        content: `Generate a list of 5-8 samples for this lab module.

Module: ${module.module_name}
Description: ${module.description}
Expertise: ${module.expertise_required}
Parent Study: ${module.study_title}
Study Design: ${module.study_design}

Return a JSON array of samples, each with:
- "sample_name": Short identifier (e.g. "Treatment Group A - 10μM", "Control Well #3")
- "description": What to do with this sample (1 sentence)

Return ONLY the JSON array, no markdown.`,
      },
    ],
    temperature: 0.6,
  });

  return parseJSON(response.choices[0].message.content, []);
}

export async function allocateModuleBudgets(study: {
  title: string;
  hypothesis: string;
  study_design: string;
  funding_goal: number;
  modules: { id: string; module_name: string; description: string; expertise_required: string }[];
}): Promise<{ id: string; percent: number; rationale: string }[]> {
  const moduleList = study.modules
    .map((m, i) => `${i + 1}. "${m.module_name}" — ${m.description || "No description"} (Expertise: ${m.expertise_required || "Not specified"})`)
    .join("\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a research grants administrator experienced in allocating budgets across experiment modules. Consider factors like equipment needs, reagent costs, personnel time, computational resources, and complexity when distributing funds.",
      },
      {
        role: "user",
        content: `Allocate a total budget of $${study.funding_goal.toLocaleString()} across the following modules for this study.

Study: ${study.title}
Hypothesis: ${study.hypothesis}
Design: ${study.study_design}
Total Budget: $${study.funding_goal.toLocaleString()}

Modules:
${moduleList}

Consider which modules are more resource-intensive (wet lab work, expensive reagents, specialized equipment, large sample sizes) vs. lighter work (data analysis, literature review, bioinformatics). Allocate proportionally.

Return a JSON array with one object per module IN THE SAME ORDER as listed above:
- "percent": number (percentage of total budget, all must sum to exactly 100)
- "rationale": string (1 sentence explaining why this module gets this share)

Return ONLY the JSON array, no markdown.`,
      },
    ],
    temperature: 0.3,
  });

  const allocations = parseJSON(response.choices[0].message.content, []) as { percent: number; rationale: string }[];

  // Map back to module IDs
  return study.modules.map((m, i) => ({
    id: m.id,
    percent: allocations[i]?.percent ?? Math.round(100 / study.modules.length),
    rationale: allocations[i]?.rationale ?? "Equal share allocation",
  }));
}

// ── Semantic Scholar search ──

interface SemanticScholarPaper {
  paperId: string;
  title: string;
  abstract: string | null;
  year: number | null;
  citationCount: number | null;
  url: string;
  authors: { name: string }[];
}

async function extractSearchQueries(hypothesis: string): Promise<string[]> {
  const response = await openai.chat.completions.create({
    model: "o3-mini",
    messages: [
      {
        role: "system",
        content:
          "You extract academic search queries from scientific hypotheses. Return 2-3 diverse search queries that would find prior work on this topic. Focus on key mechanisms, molecules, methods, and biological processes mentioned.",
      },
      {
        role: "user",
        content: `Generate search queries for Semantic Scholar to find papers related to this hypothesis:

"${hypothesis}"

Return a JSON array of 2-3 search query strings. Each query should be 4-8 words targeting different aspects of the hypothesis.

Return ONLY the JSON array, no markdown.`,
      },
    ],
  });

  const queries = parseJSON(response.choices[0].message.content, []);
  return Array.isArray(queries) ? queries.slice(0, 3) : [hypothesis.slice(0, 100)];
}

async function searchSemanticScholar(query: string, limit = 5, retries = 3): Promise<SemanticScholarPaper[]> {
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    fields: "paperId,title,abstract,year,citationCount,url,authors",
  });

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/search?${params}`,
        {
          headers: { "User-Agent": "Archimedes/1.0" },
        }
      );

      if (res.status === 429) {
        // Rate limited — wait with exponential backoff + jitter
        const delay = (2 ** attempt) * 1000 + Math.random() * 1000;
        console.warn(`Semantic Scholar rate limited, retrying in ${Math.round(delay)}ms...`);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (!res.ok) {
        console.warn(`Semantic Scholar search failed: ${res.status}`);
        return [];
      }

      const data = await res.json();
      return (data.data || []) as SemanticScholarPaper[];
    } catch (err) {
      console.warn("Semantic Scholar search error:", err);
      return [];
    }
  }

  console.warn("Semantic Scholar: exhausted retries");
  return [];
}

export async function checkHypothesisNovelty(hypothesis: string) {
  // Step 1: Extract targeted search queries from the hypothesis
  const queries = await extractSearchQueries(hypothesis);

  // Step 2: Search Semantic Scholar sequentially with small delays to avoid 429s
  const searchResults: SemanticScholarPaper[][] = [];
  for (let i = 0; i < queries.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 500)); // stagger requests
    searchResults.push(await searchSemanticScholar(queries[i], 5));
  }

  // Deduplicate by paperId and take top results
  const seen = new Set<string>();
  const allPapers: SemanticScholarPaper[] = [];
  for (const papers of searchResults) {
    for (const p of papers) {
      if (!seen.has(p.paperId)) {
        seen.add(p.paperId);
        allPapers.push(p);
      }
    }
  }

  // Sort by citation count (most cited = most relevant prior work)
  allPapers.sort((a, b) => (b.citationCount || 0) - (a.citationCount || 0));
  const topPapers = allPapers.slice(0, 10);

  // Step 3: Format papers for the LLM
  const paperSummaries = topPapers.length > 0
    ? topPapers
        .map((p, i) => {
          const authors = p.authors?.slice(0, 3).map((a) => a.name).join(", ") || "Unknown";
          const abstract = p.abstract ? p.abstract.slice(0, 300) : "No abstract available";
          return `${i + 1}. "${p.title}" (${p.year || "n.d."}, ${p.citationCount || 0} citations)
   Authors: ${authors}
   Abstract: ${abstract}...
   URL: ${p.url}`;
        })
        .join("\n\n")
    : "No related papers found in Semantic Scholar.";

  // Step 4: GPT-4o analyzes hypothesis against real papers
  const response = await openai.chat.completions.create({
    model: "o3-mini",
    messages: [
      {
        role: "system",
        content: `You are a scientific literature expert performing a novelty assessment. You have been given a hypothesis and real papers from Semantic Scholar. Your job is to determine whether the hypothesis has already been tested or closely explored in existing literature.

Be rigorous but fair:
- If a paper directly tests the same hypothesis → NOT novel (score 1-3)
- If papers test related but distinct hypotheses → PARTIALLY novel (score 4-6)
- If no papers closely match the specific hypothesis → NOVEL (score 7-10)

A hypothesis can still be novel even if the general topic has been studied, as long as the specific mechanism, combination, or approach is new.`,
      },
      {
        role: "user",
        content: `Evaluate this hypothesis for novelty against the literature found:

HYPOTHESIS: "${hypothesis}"

RELATED PAPERS FOUND:
${paperSummaries}

Analyze whether any of these papers have already tested this specific hypothesis or something very similar. Consider the specific mechanisms, targets, and approaches proposed.

Return a JSON object with:
- "is_novel": boolean - true if this is a genuinely novel hypothesis not yet tested
- "similar_work": string - detailed explanation (3-5 sentences) of the most relevant prior work found and how it relates to this hypothesis. If novel, explain why existing work doesn't cover this specific angle. Cite specific paper titles.
- "novelty_score": number from 1-10 (10 = highly novel)
- "suggestion": string - a brief suggestion to improve or refine the hypothesis

Return ONLY the JSON, no markdown.`,
      },
    ],
  });

  return parseJSON(response.choices[0].message.content);
}
