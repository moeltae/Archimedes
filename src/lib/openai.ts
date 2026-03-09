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
- "is_analysis": boolean — true if this module is primarily computational analysis, statistical analysis, data integration, or bioinformatics (i.e. it analyzes raw data produced by other modules rather than generating raw data itself). false for wet lab work, data collection, sample preparation, etc.

Every study should have at least one analysis module that integrates and analyzes results from the other modules.

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

// ── Analysis Code Generation ──

export interface AnalysisContext {
  hypothesis: string;
  study_design: string;
  module_name: string;
  module_description: string;
  expertise_required: string;
  results_summary: string;
  results_data: Record<string, unknown>;
  follow_up_prompt?: string;
}

/** Description of a file available in the sandbox for the AI prompt */
interface FileDescription {
  filename: string;
  mime_type: string;
  has_parsed_data: boolean;
}

const ANALYSIS_SYSTEM_PROMPT = `You are an expert data scientist analyzing experimental results for a scientific study. You generate Python code that performs rigorous statistical analysis and creates publication-quality visualizations.

Rules:
- Available packages: numpy, pandas, scipy, matplotlib, seaborn, scikit-learn, statsmodels, math, statistics, json, collections, PIL (Pillow), cv2 (OpenCV)
- The variable \`data\` is a Python dict containing the submission's results_data (already available in scope). For uploaded CSV/JSON files, the parsed content is also merged into \`data\` under keys like \`file_<filename>\`.
- The variable \`results_summary\` is a string with the text summary of results (already available in scope)
- FIGURES_DIR is a string path to save output figures (already available in scope)
- INPUT_DIR is a string path where uploaded files are saved on disk (already available in scope)
- FILE_PATHS is a Python dict mapping filename -> absolute file path (already available in scope). Use this to read uploaded files directly.

FILE ACCESS:
- CSV files: Use \`pd.read_csv(FILE_PATHS["filename.csv"])\` to load as DataFrame
- Excel files: Use \`pd.read_excel(FILE_PATHS["filename.xlsx"])\` to load as DataFrame
- JSON files: Use \`json.load(open(FILE_PATHS["filename.json"]))\` to load
- Image files (PNG, JPG, WEBP): Use \`from PIL import Image; img = Image.open(FILE_PATHS["image.png"])\` or \`import cv2; img = cv2.imread(FILE_PATHS["image.png"])\`
- For images: you can analyze intensity, color channels, detect features, measure areas, compare images, etc.
- Always check if a file exists in FILE_PATHS before trying to read it

DATA QUALITY:
- Before analyzing, assess whether the provided data is actually sufficient to test the hypothesis
- Check if the data contains evidence relevant to the experiment (e.g., if the study is about neural probes, check whether probes are actually visible in images)
- Print a clear DATA QUALITY ASSESSMENT section to stdout BEFORE any analysis, noting: what data was provided, what's missing, and whether the data is adequate
- If samples data is in \`data["samples"]\`, report how many are completed vs pending/failed and how many have files attached
- Be honest: if the data cannot support meaningful conclusions about the hypothesis, say so clearly
- Do NOT fabricate findings — only report what the data actually shows

OUTPUT:
- Save all figures to FIGURES_DIR using: plt.savefig(os.path.join(FIGURES_DIR, "figure_N.png"), dpi=150, bbox_inches="tight", facecolor="white")
- After each figure, call plt.close() to free memory
- Save any generated data files (processed CSVs, result tables, etc.) to OUTPUT_DIR using: df.to_csv(os.path.join(OUTPUT_DIR, "results.csv"), index=False) or similar
- Print all statistical test results clearly to stdout
- At the end, print a line: STATS_JSON: followed by a JSON object summarizing key statistical results (include a "data_quality" field with "sufficient", "partial", or "insufficient")
- Include appropriate statistical tests based on the data and experiment type
- Always include descriptive statistics (mean, std, n, etc.)
- Add clear axis labels, titles, and legends to all plots
- Use seaborn style for clean visuals: import seaborn as sns; sns.set_theme(style="whitegrid")
- Handle edge cases: check for empty data, NaN values, insufficient sample sizes
- Do NOT use plt.show() — only savefig
- Do NOT try to access the network`;

export async function generateAnalysisCode(
  context: AnalysisContext,
  files: FileDescription[] = []
): Promise<{ code: string; explanation: string }> {
  const dataPreview = JSON.stringify(context.results_data, null, 2).slice(0, 3000);

  // Build file descriptions for the prompt
  let filesSection = "";
  if (files.length > 0) {
    const fileList = files
      .map((f) => {
        const type = f.mime_type.startsWith("image/")
          ? "IMAGE"
          : f.mime_type.includes("csv")
            ? "CSV"
            : f.mime_type.includes("json")
              ? "JSON"
              : f.mime_type.includes("excel") || f.mime_type.includes("spreadsheet")
                ? "EXCEL"
                : f.mime_type.includes("pdf")
                  ? "PDF"
                  : "FILE";
        return `  - ${f.filename} (${type}, ${f.mime_type})${f.has_parsed_data ? " [parsed data available in data dict]" : " [raw file on disk]"}`;
      })
      .join("\n");
    filesSection = `\nUPLOADED FILES (available via FILE_PATHS dict):\n${fileList}\n`;
  }

  const userPrompt = `Analyze the experimental data for this study module.

EXPERIMENT CONTEXT:
- Hypothesis: ${context.hypothesis}
- Study Design: ${context.study_design}
- Module: ${context.module_name}
- Module Description: ${context.module_description}
- Expertise Area: ${context.expertise_required}

SUBMITTED DATA:
- Results Summary: ${context.results_summary}
- Data (preview): ${dataPreview}
- Data keys: ${Object.keys(context.results_data).join(", ") || "none"}
${filesSection}
${context.follow_up_prompt ? `FOLLOW-UP REQUEST: ${context.follow_up_prompt}` : ""}

Generate Python analysis code. Return a JSON object with:
- "code": The complete Python code string
- "explanation": A brief (2-3 sentence) explanation of what the analysis does

Return ONLY the JSON, no markdown.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 4096,
  });

  const result = parseJSON(response.choices[0].message.content, {
    code: "",
    explanation: "",
  }) as { code: string; explanation: string };

  return result;
}

export async function fixAnalysisCode(
  code: string,
  error: string,
  context: AnalysisContext
): Promise<{ code: string; explanation: string }> {
  const dataPreview = JSON.stringify(context.results_data, null, 2).slice(0, 2000);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: ANALYSIS_SYSTEM_PROMPT },
      {
        role: "user",
        content: `The following analysis code failed with an error. Fix it.

EXPERIMENT CONTEXT:
- Hypothesis: ${context.hypothesis}
- Module: ${context.module_name}
- Data keys: ${Object.keys(context.results_data).join(", ") || "none"}
- Data preview: ${dataPreview}
- Files on disk (FILE_PATHS dict): Check FILE_PATHS for available files. Use pd.read_csv(), pd.read_excel(), PIL.Image.open(), etc.

FAILED CODE:
\`\`\`python
${code}
\`\`\`

ERROR:
${error}

Fix the code so it runs successfully. Common issues: wrong column names, data shape mismatches, missing imports, NaN handling.

Return a JSON object with:
- "code": The fixed Python code
- "explanation": What you fixed (1 sentence)

Return ONLY the JSON, no markdown.`,
      },
    ],
    temperature: 0.3,
    max_tokens: 4096,
  });

  return parseJSON(response.choices[0].message.content, {
    code,
    explanation: "Unable to fix",
  }) as { code: string; explanation: string };
}

export async function interpretAnalysisResults(
  context: AnalysisContext,
  stdout: string,
  figureCount: number
): Promise<string> {
  // Build sample completeness summary if available
  let sampleInfo = "";
  const samples = context.results_data?.samples;
  if (Array.isArray(samples) && samples.length > 0) {
    const total = samples.length;
    const completed = samples.filter((s: Record<string, unknown>) => s.status === "completed").length;
    const withFiles = samples.filter((s: Record<string, unknown>) => (s.file_count as number) > 0).length;
    sampleInfo = `\nSAMPLE COMPLETENESS:
- ${completed}/${total} samples completed
- ${withFiles}/${total} samples have data files attached
- ${total - completed} samples still pending/failed`;
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          `You are a rigorous scientific peer reviewer interpreting experimental results. You are SKEPTICAL by default. Your job is to honestly assess what the data shows — and equally important, what it does NOT show.

Key principles:
- NEVER claim the data supports a hypothesis unless there is direct, specific evidence for it
- If the data is insufficient, incomplete, or irrelevant to the hypothesis, say so clearly
- If sample coverage is poor (many incomplete/missing samples), flag this as a major limitation
- If an image or dataset doesn't contain the expected experimental elements (e.g., no probe visible in a "probe study"), point that out
- Do NOT invent or assume findings that aren't explicitly in the analysis output
- Be constructive: explain what data WOULD be needed to properly test the hypothesis`,
      },
      {
        role: "user",
        content: `Interpret these analysis results in the context of the experiment.

EXPERIMENT:
- Hypothesis: ${context.hypothesis}
- Module: ${context.module_name} — ${context.module_description}
- Results Summary (from lab): ${context.results_summary}
${sampleInfo}

ANALYSIS OUTPUT:
${stdout.slice(0, 4000)}

${figureCount} figure(s) were generated.

Write a concise interpretation (3-5 sentences) that:
1. Honestly states whether the data is sufficient to evaluate the hypothesis — if not, say so
2. Reports only findings that are directly supported by the analysis output
3. Flags major gaps: incomplete samples, missing data, or data that doesn't match what the experiment requires
4. Suggests what additional data or steps are needed

Return ONLY the interpretation text, no JSON wrapper.`,
      },
    ],
    temperature: 0.4,
    max_tokens: 500,
  });

  return response.choices[0].message.content?.trim() || "Analysis complete.";
}
