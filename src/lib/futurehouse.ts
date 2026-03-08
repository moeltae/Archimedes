// FutureHouse Edison Platform integration
// Uses the real REST API: POST /auth/login, POST /v0.1/crows, GET /v0.1/trajectories/:id

const EDISON_API_KEY = process.env.FUTUREHOUSE_API_KEY;
const EDISON_BASE_URL =
  process.env.FUTUREHOUSE_BASE_URL || "https://api.platform.edisonscientific.com";

// Job name constants (from edison_client.models.app.JobNames)
const JOB_PRECEDENT = "job-futurehouse-paperqa3-precedent"; // OWL — precedent/novelty check
const JOB_LITERATURE = "job-futurehouse-paperqa3"; // CROW/FALCON — literature search

const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_TIME_MS = 600_000; // 10 min — OWL/CROW agents typically take 3-5 min

// ── Interfaces ──

export interface FutureHouseNoveltyResult {
  is_novel: boolean;
  similar_papers: string[];
  novelty_score: number;
  explanation: string;
}

export interface FutureHouseLiteratureResult {
  grounded: boolean;
  supporting_papers: string[];
  contradicting_papers: string[];
  summary: string;
}

// ── Auth ──

let cachedJwt: string | null = null;
let jwtExpiresAt = 0;

async function getJwt(): Promise<string | null> {
  if (!EDISON_API_KEY) {
    console.warn("FutureHouse API key not set — using OpenAI fallback");
    return null;
  }

  // Reuse cached token if still valid (with 30s buffer)
  if (cachedJwt && Date.now() < jwtExpiresAt - 30_000) {
    return cachedJwt;
  }

  const res = await fetch(`${EDISON_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: EDISON_API_KEY }),
  });

  if (!res.ok) {
    console.error(`Edison auth failed: ${res.status} ${res.statusText}`);
    return null;
  }

  const data = await res.json();
  cachedJwt = data.access_token;
  jwtExpiresAt = Date.now() + (data.expires_in || 300) * 1000;
  return cachedJwt;
}

// ── Task lifecycle ──

async function createTask(
  jobName: string,
  query: string
): Promise<string | null> {
  const jwt = await getJwt();
  if (!jwt) return null;

  const res = await fetch(`${EDISON_BASE_URL}/v0.1/crows`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
      "x-client": "sdk",
    },
    body: JSON.stringify({
      name: jobName,
      query,
      id: null,
      project_id: null,
      runtime_config: null,
    }),
  });

  if (!res.ok) {
    console.error(`Edison create_task failed: ${res.status}`);
    return null;
  }

  const data = await res.json();
  return data.trajectory_id;
}

interface EdisonTaskResult {
  status: string;
  answer?: string;
  formatted_answer?: string;
  has_successful_answer?: boolean;
  references?: Record<string, unknown>[];
}

async function getTask(taskId: string): Promise<EdisonTaskResult | null> {
  const jwt = await getJwt();
  if (!jwt) return null;

  const res = await fetch(
    `${EDISON_BASE_URL}/v0.1/trajectories/${taskId}?history=false&lite=false`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${jwt}`,
        "x-client": "sdk",
      },
    }
  );

  if (!res.ok) {
    console.error(`Edison get_task failed: ${res.status}`);
    return null;
  }

  const data = await res.json();
  const status: string = data.status;

  // Parse PQA response structure
  const envState = data.environment_frame?.state?.state;
  const responseObj = envState?.response?.answer;

  return {
    status,
    answer: responseObj?.answer ?? undefined,
    formatted_answer: responseObj?.formatted_answer ?? undefined,
    has_successful_answer: responseObj?.has_successful_answer ?? undefined,
    references: responseObj?.references ?? undefined,
  };
}

async function pollUntilDone(taskId: string): Promise<EdisonTaskResult | null> {
  const deadline = Date.now() + MAX_POLL_TIME_MS;

  while (Date.now() < deadline) {
    const result = await getTask(taskId);
    if (!result) return null;

    if (result.status === "success") return result;
    if (result.status === "fail" || result.status === "cancelled" || result.status === "truncated") {
      console.warn(`Edison task ${taskId} ended with status: ${result.status}`);
      return result;
    }

    // Still queued or in progress — wait and retry
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  console.warn(`Edison task ${taskId} timed out after ${MAX_POLL_TIME_MS}ms`);
  return null;
}

// ── Exported low-level helpers (used by review-status SSE endpoint) ──

export { getTask as getEdisonTask, pollUntilDone };

export async function createNoveltyTask(hypothesis: string): Promise<string | null> {
  return createTask(JOB_PRECEDENT, hypothesis);
}

export function parseNoveltyResult(result: EdisonTaskResult): FutureHouseNoveltyResult {
  const answer = result.answer || "";
  const hasSuccessful = result.has_successful_answer ?? false;
  const refs = Array.isArray(result.references) ? result.references : [];
  const similarPapers = refs
    .map((ref: Record<string, unknown>) => (ref.title as string) || (ref.key as string) || "")
    .filter(Boolean);
  const noveltyScore = hasSuccessful ? 3 : 7;

  return {
    is_novel: !hasSuccessful,
    similar_papers: similarPapers,
    novelty_score: noveltyScore,
    explanation: answer,
  };
}

// ── Public API ──

/**
 * Novelty / precedent check via OWL agent.
 * Returns null if API key missing or request fails (triggers OpenAI fallback).
 */
export async function checkNovelty(
  hypothesis: string
): Promise<FutureHouseNoveltyResult | null> {
  const taskId = await createTask(JOB_PRECEDENT, hypothesis);
  if (!taskId) return null;

  const result = await pollUntilDone(taskId);
  if (!result || result.status !== "success") return null;

  // Parse the OWL agent's answer into our interface
  const answer = result.answer || "";
  const hasSuccessful = result.has_successful_answer ?? false;

  // Extract paper titles from references if available
  const refs = Array.isArray(result.references) ? result.references : [];
  const similarPapers = refs
    .map((ref: Record<string, unknown>) => (ref.title as string) || (ref.key as string) || "")
    .filter(Boolean);

  // Derive novelty score: if the precedent agent found strong prior work → low novelty
  // "has_successful_answer" means it found precedent → NOT novel
  const noveltyScore = hasSuccessful ? 3 : 7;
  const isNovel = !hasSuccessful;

  return {
    is_novel: isNovel,
    similar_papers: similarPapers,
    novelty_score: noveltyScore,
    explanation: answer,
  };
}

/**
 * Literature grounding via CROW/FALCON agent.
 * Returns null if API key missing or request fails.
 */
export async function groundInLiterature(
  claim: string
): Promise<FutureHouseLiteratureResult | null> {
  const taskId = await createTask(JOB_LITERATURE, claim);
  if (!taskId) return null;

  const result = await pollUntilDone(taskId);
  if (!result || result.status !== "success") return null;

  const answer = result.answer || "";
  const hasSuccessful = result.has_successful_answer ?? false;

  const refList = Array.isArray(result.references) ? result.references : [];
  const papers = refList
    .map((ref: Record<string, unknown>) => (ref.title as string) || (ref.key as string) || "")
    .filter(Boolean);

  return {
    grounded: hasSuccessful,
    supporting_papers: papers,
    contradicting_papers: [],
    summary: answer,
  };
}
