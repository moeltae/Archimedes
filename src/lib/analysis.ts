/**
 * Analysis orchestrator — ties together OpenAI code generation,
 * Modal execution, and result storage in Supabase.
 *
 * Fetches uploaded files (CSV, Excel, JSON, images) from Supabase storage,
 * parses tabular data into structured form, and passes images as base64
 * so the Modal sandbox can work with real experimental data.
 */

import { supabase } from "./supabase";
import {
  generateAnalysisCode,
  fixAnalysisCode,
  interpretAnalysisResults,
  AnalysisContext,
} from "./openai";
import { executeAnalysisCode } from "./modal";

/** A file fetched from the submission's file_urls, ready for Modal */
export interface FetchedFile {
  filename: string;
  mime_type: string;
  /** base64-encoded raw bytes */
  base64: string;
  /** For CSV/JSON/Excel: the parsed data as a JS object (rows array or raw object) */
  parsed_data?: unknown;
}

// ── Cancellation support ──

const runningJobs = new Map<string, AbortController>();

/** Cancel a running analysis job. Returns true if the job was found and cancelled. */
export function cancelAnalysis(jobId: string): boolean {
  const controller = runningJobs.get(jobId);
  if (controller) {
    controller.abort();
    runningJobs.delete(jobId);
    return true;
  }
  return false;
}

/** Check if a job is currently running. */
export function isJobRunning(jobId: string): boolean {
  return runningJobs.has(jobId);
}

function checkCancelled(signal: AbortSignal, jobId: string): void {
  if (signal.aborted) {
    throw new AnalysisCancelledError(jobId);
  }
}

class AnalysisCancelledError extends Error {
  constructor(jobId: string) {
    super(`Analysis job ${jobId} was cancelled`);
    this.name = "AnalysisCancelledError";
  }
}

/**
 * Run the full analysis pipeline for a data submission.
 * This is called asynchronously — the caller does not wait for completion.
 */
export async function runAnalysis(
  jobId: string,
  submissionId: string,
  moduleId: string,
  followUpPrompt?: string
): Promise<void> {
  const controller = new AbortController();
  runningJobs.set(jobId, controller);
  const { signal } = controller;

  try {
    // 1. Gather experiment context + fetch files
    const { context, files } = await gatherContext(submissionId, moduleId, followUpPrompt);
    checkCancelled(signal, jobId);

    // Store context in the job for debugging/replay (without bulky base64)
    await updateJob(jobId, {
      status: "generating_code",
      prompt_context: {
        ...context,
        files_summary: files.map((f) => ({
          filename: f.filename,
          mime_type: f.mime_type,
          has_parsed_data: !!f.parsed_data,
        })),
      } as unknown as Record<string, unknown>,
    });

    // 2. Generate analysis code
    const fileDescs = files.map((f) => ({
      filename: f.filename,
      mime_type: f.mime_type,
      has_parsed_data: !!f.parsed_data,
    }));
    const { code, explanation } = await generateAnalysisCode(context, fileDescs);
    checkCancelled(signal, jobId);

    if (!code) {
      await updateJob(jobId, {
        status: "failed",
        error_message: "AI failed to generate analysis code",
      });
      return;
    }

    await updateJob(jobId, {
      generated_code: code,
      status: "executing",
    });

    // 3. Execute on Modal with retry loop
    let currentCode = code;
    let retryCount = 0;
    const maxRetries = 3;

    while (retryCount <= maxRetries) {
      checkCancelled(signal, jobId);
      const result = await executeAnalysisCode(
        currentCode,
        context.results_data,
        context.results_summary,
        files
      );

      checkCancelled(signal, jobId);

      if (result.success) {
        // 4. Parse statistical results from stdout
        const statsJson = extractStatsJson(result.stdout);

        // 5. Upload figures, output files, and generate interpretation in parallel
        const [figureUrls, outputFileUrls, interpretationResult] = await Promise.all([
          uploadFigures(result.figures, moduleId, jobId),
          uploadOutputFiles(result.output_files || [], moduleId, jobId),
          interpretAnalysisResults(context, result.stdout, result.figures.length)
            .catch((err) => {
              console.error("[analysis] Interpretation failed:", err);
              return explanation;
            }),
        ]);
        const interpretation = interpretationResult;

        // 7. Save results
        await updateJob(jobId, {
          status: "completed",
          execution_stdout: result.stdout,
          execution_stderr: result.stderr,
          execution_duration_ms: result.execution_time_ms,
          figure_urls: figureUrls,
          output_file_urls: outputFileUrls,
          statistical_results: statsJson,
          interpretation,
          completed_at: new Date().toISOString(),
          retry_count: retryCount,
        });

        // 8. Update module status to "completed" so the experiment page reflects it
        await supabase
          .from("modules")
          .update({ status: "completed" })
          .eq("id", moduleId);

        return;
      }

      // Execution failed
      if (retryCount >= maxRetries) {
        await updateJob(jobId, {
          status: "failed",
          error_message: result.stderr || "Code execution failed after max retries",
          execution_stdout: result.stdout,
          execution_stderr: result.stderr,
          execution_duration_ms: result.execution_time_ms,
          retry_count: retryCount,
        });
        return;
      }

      // Try to fix the code
      retryCount++;
      await updateJob(jobId, {
        status: "retrying",
        retry_count: retryCount,
        execution_stderr: result.stderr,
      });

      try {
        const fix = await fixAnalysisCode(currentCode, result.stderr, context);
        currentCode = fix.code;
        await updateJob(jobId, {
          generated_code: currentCode,
          status: "executing",
        });
      } catch (err) {
        await updateJob(jobId, {
          status: "failed",
          error_message: `Code fix attempt ${retryCount} failed: ${err instanceof Error ? err.message : String(err)}`,
          retry_count: retryCount,
        });
        return;
      }
    }
  } catch (err) {
    if (err instanceof AnalysisCancelledError) {
      console.log(`[analysis] Job ${jobId} cancelled`);
      await updateJob(jobId, {
        status: "cancelled",
        error_message: "Analysis was cancelled by user",
      });
    } else {
      console.error("[analysis] Pipeline error:", err);
      await updateJob(jobId, {
        status: "failed",
        error_message: err instanceof Error ? err.message : String(err),
      });
    }
  } finally {
    runningJobs.delete(jobId);
  }
}

async function gatherContext(
  submissionId: string,
  moduleId: string,
  followUpPrompt?: string
): Promise<{ context: AnalysisContext; files: FetchedFile[] }> {
  // Get module with parent experiment
  const { data: mod } = await supabase
    .from("modules")
    .select(
      "*, experiment:experiments(title, hypothesis, study_design)"
    )
    .eq("id", moduleId)
    .single();

  if (!mod) throw new Error(`Module ${moduleId} not found`);

  const experiment = mod.experiment as {
    title: string;
    hypothesis: string;
    study_design: string;
  } | null;

  const isAnalysisModule = mod.is_analysis === true;

  // For analysis modules, gather data from ALL sibling modules in the study.
  // For regular modules, just use the triggering submission.
  let allSubmissions: {
    id: string;
    module_id: string;
    results_summary: string;
    results_data: Record<string, unknown>;
    file_urls: string[];
    notes: string;
    module_name?: string;
  }[] = [];

  if (isAnalysisModule) {
    // Get all sibling modules in the same study
    const { data: siblingModules } = await supabase
      .from("modules")
      .select("id, module_name")
      .eq("experiment_id", mod.experiment_id)
      .neq("id", moduleId);

    const siblingIds = (siblingModules || []).map((m) => m.id);
    const moduleNameMap: Record<string, string> = {};
    for (const m of siblingModules || []) {
      moduleNameMap[m.id] = m.module_name;
    }

    if (siblingIds.length > 0) {
      // Fetch ALL submissions from sibling modules
      const { data: siblingSubmissions } = await supabase
        .from("data_submissions")
        .select("*")
        .in("module_id", siblingIds)
        .order("submitted_at", { ascending: true });

      allSubmissions = (siblingSubmissions || []).map((s) => ({
        ...s,
        module_name: moduleNameMap[s.module_id] || "Unknown module",
      }));
    }

    // Also include the triggering submission if not already present
    const triggerAlreadyIncluded = allSubmissions.some((s) => s.id === submissionId);
    if (!triggerAlreadyIncluded) {
      const { data: triggerSub } = await supabase
        .from("data_submissions")
        .select("*")
        .eq("id", submissionId)
        .single();
      if (triggerSub) {
        allSubmissions.push({
          ...triggerSub,
          module_name: moduleNameMap[triggerSub.module_id] || "Triggering module",
        });
      }
    }
  } else {
    // Regular module — just use the single submission
    const { data: submission } = await supabase
      .from("data_submissions")
      .select("*")
      .eq("id", submissionId)
      .single();

    if (!submission) throw new Error(`Submission ${submissionId} not found`);
    allSubmissions = [submission];
  }

  if (allSubmissions.length === 0) {
    throw new Error("No submissions found to analyze");
  }

  // Gather files and data from all submissions
  const files: FetchedFile[] = [];
  const resultsData: Record<string, unknown> = {};
  const summaryParts: string[] = [];

  for (const sub of allSubmissions) {
    const prefix = isAnalysisModule && sub.module_name
      ? `[${sub.module_name}]`
      : "";

    // Collect results summary
    if (sub.results_summary) {
      summaryParts.push(prefix ? `${prefix} ${sub.results_summary}` : sub.results_summary);
    }
    if (sub.notes) {
      summaryParts.push(prefix ? `${prefix} Notes: ${sub.notes}` : `Notes: ${sub.notes}`);
    }

    // Merge results_data with module-prefixed keys for analysis modules
    if (sub.results_data && typeof sub.results_data === "object") {
      if (isAnalysisModule && sub.module_name) {
        const moduleKey = sub.module_name
          .replace(/[^a-zA-Z0-9_]/g, "_")
          .toLowerCase();
        resultsData[`module_${moduleKey}`] = sub.results_data;
      } else {
        Object.assign(resultsData, sub.results_data);
      }
    }

    // Fetch and parse uploaded files from this submission
    const subFileUrls: string[] = sub.file_urls || [];
    const subFiles = await fetchAndParseFiles(subFileUrls);
    for (const f of subFiles) {
      // Prefix filename with module name for disambiguation in analysis modules
      if (isAnalysisModule && sub.module_name) {
        const safeModName = sub.module_name.replace(/[^a-zA-Z0-9_-]/g, "_");
        f.filename = `${safeModName}_${f.filename}`;
      }
      files.push(f);
    }
  }

  // Fetch sample data from relevant modules
  const sampleModuleIds = isAnalysisModule
    ? [...new Set(allSubmissions.map((s) => s.module_id)), moduleId]
    : [moduleId];

  const { data: samples } = await supabase
    .from("samples")
    .select("sample_name, description, status, file_urls, processed_at, module_id")
    .in("module_id", sampleModuleIds)
    .order("created_at", { ascending: true });

  // Fetch files attached to individual samples (in parallel)
  if (samples) {
    const samplesWithFiles = samples.filter((s) => s.file_urls && s.file_urls.length > 0);
    const sampleFileResults = await Promise.all(
      samplesWithFiles.map(async (sample) => {
        const sampleFiles = await fetchAndParseFiles(sample.file_urls);
        for (const sf of sampleFiles) {
          sf.filename = `${sample.sample_name}_${sf.filename}`;
        }
        return sampleFiles;
      })
    );
    for (const sampleFiles of sampleFileResults) {
      files.push(...sampleFiles);
    }
  }

  // Merge parsed file data into resultsData
  for (const file of files) {
    if (file.parsed_data) {
      const key = file.filename
        .replace(/\.[^.]+$/, "")
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .toLowerCase();
      resultsData[`file_${key}`] = file.parsed_data;
    }
  }

  // Include sample tracker data
  if (samples && samples.length > 0) {
    resultsData["samples"] = samples.map((s) => ({
      name: s.sample_name,
      description: s.description,
      status: s.status,
      processed_at: s.processed_at,
      file_count: (s.file_urls || []).length,
    }));
  }

  const fullSummary = summaryParts.join("\n\n");

  const context: AnalysisContext = {
    hypothesis: experiment?.hypothesis || "",
    study_design: experiment?.study_design || "",
    module_name: mod.module_name || "",
    module_description: mod.description || "",
    expertise_required: mod.expertise_required || "",
    results_summary: fullSummary,
    results_data: resultsData,
    follow_up_prompt: followUpPrompt,
  };

  return { context, files };
}

// ── File fetching & parsing ──

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function guessMime(url: string): string {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    csv: "text/csv",
    json: "application/json",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    xls: "application/vnd.ms-excel",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
    txt: "text/plain",
  };
  return map[ext] || "application/octet-stream";
}

function extractFilename(url: string): string {
  try {
    const path = new URL(url).pathname;
    const raw = path.split("/").pop() || "file";
    // Strip leading timestamp prefixes like "1234567890_"
    return decodeURIComponent(raw).replace(/^\d+_/, "");
  } catch {
    return "file";
  }
}

async function fetchAndParseFiles(urls: string[]): Promise<FetchedFile[]> {
  const results = await Promise.all(
    urls.map(async (url): Promise<FetchedFile | null> => {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(`[analysis] Failed to fetch file ${url}: ${res.status}`);
          return null;
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > MAX_FILE_SIZE) {
          console.warn(`[analysis] File too large, skipping: ${url}`);
          return null;
        }

        const mime = res.headers.get("content-type")?.split(";")[0] || guessMime(url);
        const filename = extractFilename(url);
        const base64 = buffer.toString("base64");

        const file: FetchedFile = { filename, mime_type: mime, base64 };

        // Parse tabular data
        if (mime === "text/csv" || filename.endsWith(".csv")) {
          file.parsed_data = parseCSV(buffer.toString("utf-8"));
        } else if (mime === "application/json" || filename.endsWith(".json")) {
          try {
            file.parsed_data = JSON.parse(buffer.toString("utf-8"));
          } catch {
            // Not valid JSON, leave as raw
          }
        } else if (mime === "text/plain" || filename.endsWith(".txt")) {
          file.parsed_data = buffer.toString("utf-8").slice(0, 50_000);
        }

        return file;
      } catch (err) {
        console.warn(`[analysis] Error fetching file ${url}:`, err);
        return null;
      }
    })
  );

  return results.filter((f): f is FetchedFile => f !== null);
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  // Simple CSV parser — handles quoted fields
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length && i < 10_000; i++) {
    if (!lines[i].trim()) continue;
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, j) => {
      row[h] = values[j] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

function extractStatsJson(stdout: string): Record<string, unknown> {
  // Look for STATS_JSON: line in stdout
  const lines = stdout.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith("STATS_JSON:")) {
      try {
        return JSON.parse(line.slice("STATS_JSON:".length).trim());
      } catch {
        // Ignore parse errors
      }
    }
  }
  return {};
}

async function uploadFigures(
  figures: string[],
  moduleId: string,
  jobId: string
): Promise<string[]> {
  const results = await Promise.all(
    figures.map(async (dataUri, i) => {
      const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) {
        return dataUri;
      }

      const mimeType = match[1];
      const base64Data = match[2];
      const ext = mimeType.includes("png") ? "png" : mimeType.includes("svg") ? "svg" : "jpg";
      const fileName = `analysis/${moduleId}/${jobId}/figure_${i}.${ext}`;

      const buffer = Buffer.from(base64Data, "base64");

      const { error } = await supabase.storage
        .from("attachments")
        .upload(fileName, buffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (error) {
        console.error(`[analysis] Failed to upload figure ${i}:`, error.message);
        return dataUri;
      }

      const { data: publicUrl } = supabase.storage
        .from("attachments")
        .getPublicUrl(fileName);
      return publicUrl.publicUrl;
    })
  );

  return results;
}

async function uploadOutputFiles(
  outputFiles: { filename: string; mime_type: string; base64: string }[],
  moduleId: string,
  jobId: string
): Promise<string[]> {
  const results = await Promise.all(
    outputFiles.map(async (file) => {
      const fileName = `analysis/${moduleId}/${jobId}/outputs/${file.filename}`;
      const buffer = Buffer.from(file.base64, "base64");

      const { error } = await supabase.storage
        .from("attachments")
        .upload(fileName, buffer, {
          contentType: file.mime_type,
          upsert: true,
        });

      if (error) {
        console.error(`[analysis] Failed to upload output ${file.filename}:`, error.message);
        return null;
      }

      const { data: publicUrl } = supabase.storage
        .from("attachments")
        .getPublicUrl(fileName);
      return publicUrl.publicUrl;
    })
  );

  return results.filter((url): url is string => url !== null);
}

async function updateJob(
  jobId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from("analysis_jobs")
    .update(updates)
    .eq("id", jobId);

  if (error) {
    console.error("[analysis] Failed to update job:", error.message);
  }
}
