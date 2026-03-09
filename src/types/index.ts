export interface Paper {
  id: string;
  title: string;
  abstract: string;
  claims: string;
  research_gap: string;
  source_url: string | null;
  created_at: string;
}

export interface Study {
  id: string;
  paper_id: string;
  title: string;
  hypothesis: string;
  study_design: string;
  funding_goal: number;
  funded_amount: number;
  upvotes: number;
  downvotes: number;
  tags: string[];
  status: "pending_review" | "proposed" | "rejected" | "funded" | "in_progress" | "completed";
  novelty_score?: number | null;
  review_explanation?: string | null;
  review_task_id?: string | null;
  rejected_at?: string | null;
  created_at: string;
  paper?: Paper;
  experiments?: StudyExperiment[];
  comments?: Comment[];
}

export const SCIENCE_FIELDS = [
  "Neuroscience",
  "Molecular Biology",
  "Genetics",
  "Immunology",
  "Oncology",
  "Microbiology",
  "Pharmacology",
  "Bioinformatics",
  "Cell Biology",
  "Ecology",
  "Biochemistry",
  "Bioengineering",
  "Epidemiology",
  "Physiology",
  "Developmental Biology",
  "Evolutionary Biology",
  "Plant Biology",
  "Systems Biology",
  "Scientific Communication",
  "Zoology",
  "Paleontology",
  "Climate Science",
  "Psychology",
] as const;

export type ScienceField = (typeof SCIENCE_FIELDS)[number];

export const FIELD_COLORS: Record<string, { bg: string; text: string }> = {
  Neuroscience:              { bg: "bg-purple-50",  text: "text-purple-700" },
  "Molecular Biology":       { bg: "bg-rose-50",    text: "text-rose-700" },
  Genetics:                  { bg: "bg-indigo-50",  text: "text-indigo-700" },
  Immunology:                { bg: "bg-amber-50",   text: "text-amber-700" },
  Oncology:                  { bg: "bg-red-50",     text: "text-red-700" },
  Microbiology:              { bg: "bg-lime-50",    text: "text-lime-700" },
  Pharmacology:              { bg: "bg-pink-50",    text: "text-pink-700" },
  Bioinformatics:            { bg: "bg-cyan-50",    text: "text-cyan-700" },
  "Cell Biology":            { bg: "bg-teal-50",    text: "text-teal-700" },
  Ecology:                   { bg: "bg-emerald-50", text: "text-emerald-700" },
  Biochemistry:              { bg: "bg-orange-50",  text: "text-orange-700" },
  Bioengineering:            { bg: "bg-sky-50",     text: "text-sky-700" },
  Epidemiology:              { bg: "bg-yellow-50",  text: "text-yellow-700" },
  Physiology:                { bg: "bg-fuchsia-50", text: "text-fuchsia-700" },
  "Developmental Biology":   { bg: "bg-violet-50",  text: "text-violet-700" },
  "Evolutionary Biology":    { bg: "bg-stone-100",  text: "text-stone-700" },
  "Plant Biology":           { bg: "bg-green-50",   text: "text-green-700" },
  "Systems Biology":         { bg: "bg-slate-100",  text: "text-slate-700" },
  "Scientific Communication": { bg: "bg-blue-50",   text: "text-blue-700" },
  Zoology:                   { bg: "bg-amber-50",   text: "text-amber-800" },
  Paleontology:              { bg: "bg-stone-50",   text: "text-stone-600" },
  "Climate Science":         { bg: "bg-sky-100",    text: "text-sky-800" },
  Psychology:                { bg: "bg-pink-100",   text: "text-pink-800" },
};

export function getFieldColor(field: string) {
  return FIELD_COLORS[field] || { bg: "bg-blue-50", text: "text-blue-700" };
}

export interface StudyExperiment {
  id: string;
  experiment_id: string;
  module_name: string;
  description: string;
  expertise_required: string;
  status: "open" | "claimed" | "in_progress" | "completed";
  assigned_lab: string | null;
  claimed_by?: string | null;
  budget_pct?: number | null;
  budget_rationale?: string | null;
  is_analysis?: boolean;
}

export interface Vote {
  id: string;
  experiment_id: string;
  vote_type: "up" | "down";
  session_id: string;
  created_at: string;
}

export interface ModuleClaim {
  id: string;
  module_id: string;
  session_id: string;
  lab_name: string;
  contact_email: string | null;
  claimed_at: string;
}

export interface Sample {
  id: string;
  module_id: string;
  sample_name: string;
  description: string | null;
  status: "pending" | "in_progress" | "completed" | "failed";
  file_urls: string[];
  processed_at: string | null;
  created_at: string;
}

export interface DataSubmission {
  id: string;
  module_id: string;
  session_id: string;
  submitted_by_lab: string;
  submission_type: "results" | "partial" | "failed";
  results_summary: string | null;
  results_data: Record<string, unknown>;
  file_urls: string[];
  notes: string | null;
  submitted_at: string;
}

export interface MyModule extends StudyExperiment {
  experiment_title: string;
  experiment_hypothesis: string;
  experiment_study_design: string;
  experiment_tags: string[];
  claimed_at: string;
  samples_total: number;
  samples_completed: number;
  has_submission: boolean;
  study_funding_goal: number;
  study_funded_amount: number;
  total_modules_in_study: number;
  budget_pct: number | null;
  budget_rationale: string | null;
}

export const BUDGET_CATEGORIES = [
  { key: "personnel", label: "Personnel & Labor", percent: 40, color: "#3b82f6", description: "Researcher time, technicians, assistants" },
  { key: "consumables", label: "Consumables & Reagents", percent: 25, color: "#10b981", description: "Lab supplies, chemicals, biological samples" },
  { key: "equipment", label: "Equipment & Facilities", percent: 15, color: "#f59e0b", description: "Instrument access, maintenance, facility fees" },
  { key: "overhead", label: "Overhead & Admin", percent: 15, color: "#8b5cf6", description: "Institutional overhead, insurance, reporting" },
  { key: "contingency", label: "Contingency", percent: 5, color: "#6b7280", description: "Unexpected costs, protocol adjustments" },
] as const;

export interface Comment {
  id: string;
  experiment_id: string;
  parent_id: string | null;
  session_id: string;
  author_name: string;
  body: string;
  created_at: string;
  replies?: Comment[];
}

export interface AnalysisJob {
  id: string;
  submission_id: string;
  module_id: string;
  status: 'pending' | 'generating_code' | 'executing' | 'retrying' | 'completed' | 'failed' | 'cancelled';
  generated_code: string | null;
  code_language: string;
  prompt_context: Record<string, unknown>;
  modal_call_id: string | null;
  execution_stdout: string | null;
  execution_stderr: string | null;
  execution_duration_ms: number | null;
  figure_urls: string[];
  output_file_urls: string[];
  statistical_results: Record<string, unknown>;
  interpretation: string | null;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  created_at: string;
  completed_at: string | null;
  follow_up_prompt: string | null;
}
