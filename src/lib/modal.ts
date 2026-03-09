/**
 * Modal client — calls the deployed Modal web endpoint to execute
 * AI-generated Python analysis code in a sandboxed container.
 */

import type { FetchedFile } from "./analysis";

export interface ModalOutputFile {
  filename: string;
  mime_type: string;
  base64: string;
}

export interface ModalExecutionResult {
  success: boolean;
  stdout: string;
  stderr: string;
  figures: string[]; // data URIs (base64-encoded images)
  output_files: ModalOutputFile[]; // generated CSV, JSON, Excel files
  execution_time_ms: number;
}

const MODAL_ENDPOINT_URL = process.env.MODAL_ENDPOINT_URL;
const MODAL_TIMEOUT = 180_000; // 3 minutes

export async function executeAnalysisCode(
  code: string,
  data: Record<string, unknown>,
  resultsSummary: string = "",
  files: FetchedFile[] = []
): Promise<ModalExecutionResult> {
  if (!MODAL_ENDPOINT_URL) {
    throw new Error(
      "MODAL_ENDPOINT_URL not configured. Deploy the Modal app and set the URL in .env"
    );
  }

  // Prepare files payload — send filename, mime, and base64 content
  const filesPayload = files.map((f) => ({
    filename: f.filename,
    mime_type: f.mime_type,
    base64: f.base64,
  }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MODAL_TIMEOUT);

  try {
    const res = await fetch(MODAL_ENDPOINT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        data,
        results_summary: resultsSummary,
        files: filesPayload,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Modal returned ${res.status}: ${text}`);
    }

    const result = await res.json();

    return {
      success: result.success ?? false,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      figures: result.figures ?? [],
      output_files: result.output_files ?? [],
      execution_time_ms: result.execution_time_ms ?? 0,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        success: false,
        stdout: "",
        stderr: "Execution timed out after 3 minutes",
        figures: [],
        output_files: [],
        execution_time_ms: MODAL_TIMEOUT,
      };
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
