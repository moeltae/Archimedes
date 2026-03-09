import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { executeAnalysisCode } from "@/lib/modal";
import OpenAI from "openai";

/**
 * POST /api/analysis/demo
 *
 * Demo analysis route that generates context-aware mock CSV data and
 * analysis code based on the actual module's experiment, then executes
 * on Modal to produce real figures.
 *
 * Body: { module_id }
 */

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const moduleId = body.module_id;

  if (!moduleId) {
    return NextResponse.json({ error: "module_id required" }, { status: 400 });
  }

  // Fetch module with parent experiment context
  const { data: mod } = await supabase
    .from("modules")
    .select("*, experiment:experiments(title, hypothesis, study_design, tags)")
    .eq("id", moduleId)
    .single();

  if (!mod) {
    return NextResponse.json({ error: "Module not found" }, { status: 404 });
  }

  const experiment = mod.experiment as {
    title: string;
    hypothesis: string;
    study_design: string;
    tags: string[];
  } | null;

  // Generate context-aware mock data + analysis code via OpenAI
  const generated = await generateDemoDataAndCode({
    hypothesis: experiment?.hypothesis || "",
    study_design: experiment?.study_design || "",
    module_name: mod.module_name || "",
    module_description: mod.description || "",
    expertise_required: mod.expertise_required || "",
  });

  if (!generated) {
    return NextResponse.json({ error: "Failed to generate demo data" }, { status: 500 });
  }

  // Create mock data submission
  const { data: sub, error: subErr } = await supabase
    .from("data_submissions")
    .insert({
      module_id: moduleId,
      session_id: "demo",
      submitted_by_lab: "Demo Lab",
      submission_type: "results",
      results_summary: generated.results_summary,
      results_data: generated.data_dict,
      file_urls: [],
      notes: "Demo data — AI-generated mock dataset for pipeline demonstration.",
    })
    .select()
    .single();

  if (subErr || !sub) {
    return NextResponse.json(
      { error: subErr?.message || "Failed to create submission" },
      { status: 500 }
    );
  }

  // Create analysis job
  const { data: job, error: jobErr } = await supabase
    .from("analysis_jobs")
    .insert({
      submission_id: sub.id,
      module_id: moduleId,
      status: "executing",
      generated_code: generated.code,
    })
    .select()
    .single();

  if (jobErr || !job) {
    return NextResponse.json(
      { error: jobErr?.message || "Failed to create job" },
      { status: 500 }
    );
  }

  // Fire-and-forget: execute on Modal
  runDemoAnalysis(job.id, moduleId, generated).catch((err) =>
    console.error("[analysis/demo] Background error:", err)
  );

  return NextResponse.json({
    job_id: job.id,
    module_id: moduleId,
    submission_id: sub.id,
    status: "executing",
  });
}

// ── Types ──

interface GeneratedDemo {
  code: string;
  data_dict: Record<string, unknown>;
  results_summary: string;
  interpretation: string;
}

// ── OpenAI: generate contextual mock data + code ──

async function generateDemoDataAndCode(context: {
  hypothesis: string;
  study_design: string;
  module_name: string;
  module_description: string;
  expertise_required: string;
}): Promise<GeneratedDemo | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You generate realistic mock experimental datasets and Python analysis code for scientific demo purposes.

You will be given an experiment module's context. Your job:

1. **Invent realistic mock CSV data** that would plausibly come from this experiment. Include:
   - At least 2 CSV datasets as string values in a dict
   - Realistic column names, units, and values for the field
   - At least 20-50 rows per dataset with natural variance
   - Treatment vs control groups where appropriate

2. **Write complete Python analysis code** that:
   - Reads CSVs from \`data\` dict using \`pd.read_csv(io.StringIO(data["key"]))\`
   - Produces 3-4 publication-quality figures saved to FIGURES_DIR
   - Runs appropriate statistical tests (t-tests, ANOVA, correlation, etc.)
   - Prints a DATA QUALITY ASSESSMENT section
   - Prints clear statistical results
   - Ends with \`STATS_JSON: {...}\` line containing key results and \`"data_quality": "sufficient"\`
   - Uses seaborn styling: \`sns.set_theme(style="whitegrid", font_scale=1.1)\`
   - Saves figures with: \`plt.savefig(os.path.join(FIGURES_DIR, "figure_N.png"), dpi=150, bbox_inches="tight", facecolor="white")\`
   - Calls \`plt.close()\` after each figure
   - Does NOT use \`plt.show()\`

3. **Write a brief results summary** (1-2 sentences) describing what data was collected.

4. **Write an interpretation** (3-5 sentences) that honestly describes what the mock data shows relative to the hypothesis.

Available packages: numpy, pandas, scipy, matplotlib, seaborn, scikit-learn, statsmodels, io, os, json
Available variables in scope: \`data\` (dict), \`FIGURES_DIR\` (str), \`OUTPUT_DIR\` (str)

Return a JSON object with:
- "data_dict": object where keys are descriptive names and values are CSV strings
- "code": the complete Python code string
- "results_summary": 1-2 sentence summary of the mock dataset
- "interpretation": 3-5 sentence interpretation

Return ONLY the JSON, no markdown fences.`,
        },
        {
          role: "user",
          content: `Generate a realistic mock dataset and analysis for this experiment module:

HYPOTHESIS: ${context.hypothesis}
STUDY DESIGN: ${context.study_design}
MODULE: ${context.module_name}
MODULE DESCRIPTION: ${context.module_description}
EXPERTISE: ${context.expertise_required}

Make the data realistic for this specific field. The figures should look like they belong in a paper about this topic.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 6000,
    });

    const raw = response.choices[0].message.content || "";
    const cleaned = raw
      .replace(/^```(?:json)?\s*\n?/i, "")
      .replace(/\n?```\s*$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as {
      data_dict: Record<string, unknown>;
      code: string;
      results_summary: string;
      interpretation: string;
    };

    return parsed;
  } catch (err) {
    console.error("[analysis/demo] Failed to generate demo data:", err);
    return null;
  }
}

// ── Execute on Modal and store results ──

async function runDemoAnalysis(
  jobId: string,
  moduleId: string,
  generated: GeneratedDemo
) {
  try {
    const result = await executeAnalysisCode(
      generated.code,
      generated.data_dict,
      generated.results_summary,
      []
    );

    if (result.success) {
      // Extract STATS_JSON
      const statsLine = result.stdout
        .split("\n")
        .reverse()
        .find((l) => l.trim().startsWith("STATS_JSON:"));
      let statsJson = {};
      if (statsLine) {
        try {
          statsJson = JSON.parse(statsLine.slice("STATS_JSON:".length).trim());
        } catch {
          /* ignore */
        }
      }

      // Upload figures
      const figureUrls: string[] = [];
      for (let i = 0; i < result.figures.length; i++) {
        const dataUri = result.figures[i];
        const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
          figureUrls.push(dataUri);
          continue;
        }
        const [, mimeType, base64Data] = match;
        const ext = mimeType.includes("png") ? "png" : "jpg";
        const fileName = `analysis/${moduleId}/${jobId}/figure_${i}.${ext}`;
        const buffer = Buffer.from(base64Data, "base64");

        const { error } = await supabase.storage
          .from("attachments")
          .upload(fileName, buffer, { contentType: mimeType, upsert: true });

        if (error) {
          figureUrls.push(dataUri);
        } else {
          const { data: pub } = supabase.storage
            .from("attachments")
            .getPublicUrl(fileName);
          figureUrls.push(pub.publicUrl);
        }
      }

      await supabase
        .from("analysis_jobs")
        .update({
          status: "completed",
          execution_stdout: result.stdout,
          execution_stderr: result.stderr,
          execution_duration_ms: result.execution_time_ms,
          figure_urls: figureUrls,
          output_file_urls: [],
          statistical_results: statsJson,
          interpretation: generated.interpretation,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      console.log(
        `[analysis/demo] Job ${jobId} completed with ${figureUrls.length} figures`
      );
    } else {
      await supabase
        .from("analysis_jobs")
        .update({
          status: "failed",
          execution_stdout: result.stdout,
          execution_stderr: result.stderr,
          execution_duration_ms: result.execution_time_ms,
          error_message: result.stderr || "Modal execution failed",
        })
        .eq("id", jobId);
    }
  } catch (err) {
    await supabase
      .from("analysis_jobs")
      .update({
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      })
      .eq("id", jobId);
  }
}
