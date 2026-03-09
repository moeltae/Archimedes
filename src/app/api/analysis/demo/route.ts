import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { executeAnalysisCode } from "@/lib/modal";

/**
 * POST /api/analysis/demo
 *
 * Mock analysis route that bypasses OpenAI and uses hardcoded CSV data +
 * Python analysis code to demonstrate the full pipeline with real Modal
 * execution and figure generation.
 *
 * Body: { module_id } — optional, will use an existing module or create a
 *       temporary submission if omitted.
 */

// ── Mock CSV data: longitudinal neural probe study ──

const IMPEDANCE_CSV = `day,probe_type,impedance_kohm,snr_db,animal_id
1,sub_25um,120.3,18.2,A1
1,sub_25um,115.7,17.8,A2
1,sub_25um,122.1,18.5,A3
1,sub_25um,118.9,17.6,A4
1,sub_25um,119.5,18.0,A5
1,large_50um,125.4,17.1,B1
1,large_50um,130.2,16.8,B2
1,large_50um,128.7,16.5,B3
1,large_50um,132.1,16.9,B4
1,large_50um,127.3,17.0,B5
7,sub_25um,135.2,17.5,A1
7,sub_25um,130.8,17.2,A2
7,sub_25um,138.6,17.8,A3
7,sub_25um,132.4,17.0,A4
7,sub_25um,134.1,17.3,A5
7,large_50um,165.3,15.2,B1
7,large_50um,172.8,14.8,B2
7,large_50um,168.4,15.0,B3
7,large_50um,175.1,14.5,B4
7,large_50um,170.6,14.9,B5
14,sub_25um,142.1,17.0,A1
14,sub_25um,138.5,16.8,A2
14,sub_25um,145.3,17.2,A3
14,sub_25um,140.7,16.6,A4
14,sub_25um,141.9,16.9,A5
14,large_50um,198.4,13.8,B1
14,large_50um,205.7,13.2,B2
14,large_50um,201.3,13.5,B3
14,large_50um,210.2,12.9,B4
14,large_50um,203.8,13.1,B5
30,sub_25um,148.6,16.5,A1
30,sub_25um,144.2,16.3,A2
30,sub_25um,151.8,16.8,A3
30,sub_25um,146.9,16.1,A4
30,sub_25um,149.3,16.4,A5
30,large_50um,245.1,11.5,B1
30,large_50um,252.3,11.0,B2
30,large_50um,248.7,11.3,B3
30,large_50um,258.4,10.7,B4
30,large_50um,250.6,11.1,B5
60,sub_25um,155.3,16.0,A1
60,sub_25um,150.8,15.8,A2
60,sub_25um,158.7,16.2,A3
60,sub_25um,153.2,15.6,A4
60,sub_25um,156.1,15.9,A5
60,large_50um,295.4,9.2,B1
60,large_50um,308.7,8.7,B2
60,large_50um,301.2,9.0,B3
60,large_50um,315.6,8.4,B4
60,large_50um,303.8,8.8,B5
90,sub_25um,160.1,15.6,A1
90,sub_25um,155.4,15.4,A2
90,sub_25um,163.9,15.8,A3
90,sub_25um,158.3,15.2,A4
90,sub_25um,161.5,15.5,A5
90,large_50um,342.1,7.5,B1
90,large_50um,358.4,7.0,B2
90,large_50um,350.7,7.3,B3
90,large_50um,365.2,6.7,B4
90,large_50um,355.3,7.1,B5
180,sub_25um,165.8,15.2,A1
180,sub_25um,160.2,15.0,A2
180,sub_25um,169.4,15.4,A3
180,sub_25um,163.7,14.8,A4
180,sub_25um,167.1,15.1,A5
180,large_50um,398.5,5.8,B1
180,large_50um,415.2,5.2,B2
180,large_50um,407.8,5.5,B3
180,large_50um,422.1,4.9,B4
180,large_50um,410.6,5.3,B5`;

const HISTOLOGY_CSV = `animal_id,probe_type,glial_scar_thickness_um,neuron_density_per_mm2,blood_vessel_displacement_um,tissue_damage_score
A1,sub_25um,12.3,1850,8.5,1.2
A2,sub_25um,10.8,1920,7.2,1.0
A3,sub_25um,13.1,1780,9.1,1.4
A4,sub_25um,11.5,1890,7.8,1.1
A5,sub_25um,12.0,1860,8.3,1.3
B1,large_50um,45.2,1210,32.4,3.8
B2,large_50um,48.7,1150,35.1,4.1
B3,large_50um,46.3,1180,33.7,3.9
B4,large_50um,50.1,1120,36.8,4.3
B5,large_50um,47.5,1160,34.5,4.0`;

// ── Hardcoded Python analysis code ──

const ANALYSIS_CODE = `
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import stats
import os
import io
import json

sns.set_theme(style="whitegrid", font_scale=1.1)

# ── Load data ──
impedance_df = pd.read_csv(io.StringIO(data.get("impedance_csv", "")))
histology_df = pd.read_csv(io.StringIO(data.get("histology_csv", "")))

print("=" * 60)
print("DATA QUALITY ASSESSMENT")
print("=" * 60)
print(f"Impedance dataset: {len(impedance_df)} measurements across {impedance_df['day'].nunique()} timepoints")
print(f"Probe types: {impedance_df['probe_type'].unique().tolist()}")
print(f"Animals per group: {impedance_df.groupby('probe_type')['animal_id'].nunique().to_dict()}")
print(f"Histology dataset: {len(histology_df)} animals")

samples = data.get("samples", [])
if samples:
    total = len(samples)
    completed = sum(1 for s in samples if s.get("status") == "completed")
    with_files = sum(1 for s in samples if s.get("file_count", 0) > 0)
    print(f"\\nSample tracker: {completed}/{total} completed, {with_files}/{total} with files")

print(f"\\nData quality: SUFFICIENT — complete longitudinal impedance + post-mortem histology")
print("=" * 60)
print()

# ── Figure 1: Impedance over time by probe type ──
fig, ax = plt.subplots(figsize=(10, 6))

for probe_type, color, marker in [("sub_25um", "#2563eb", "o"), ("large_50um", "#dc2626", "s")]:
    grp = impedance_df[impedance_df["probe_type"] == probe_type]
    means = grp.groupby("day")["impedance_kohm"].mean()
    sems = grp.groupby("day")["impedance_kohm"].sem()
    label = "Sub-25\\u03bcm probe" if "sub" in probe_type else "50\\u03bcm probe"
    ax.errorbar(means.index, means.values, yerr=sems.values,
                marker=marker, capsize=4, linewidth=2, markersize=7,
                label=label, color=color)

ax.set_xlabel("Days Post-Implantation")
ax.set_ylabel("Impedance (k\\u03a9)")
ax.set_title("Electrode Impedance Over 6 Months")
ax.legend(frameon=True, fancybox=True, shadow=True)
ax.set_xlim(-5, 185)
plt.tight_layout()
plt.savefig(os.path.join(FIGURES_DIR, "figure_0.png"), dpi=150, bbox_inches="tight", facecolor="white")
plt.close()

# ── Figure 2: SNR over time ──
fig, ax = plt.subplots(figsize=(10, 6))

for probe_type, color, marker in [("sub_25um", "#2563eb", "o"), ("large_50um", "#dc2626", "s")]:
    grp = impedance_df[impedance_df["probe_type"] == probe_type]
    means = grp.groupby("day")["snr_db"].mean()
    sems = grp.groupby("day")["snr_db"].sem()
    label = "Sub-25\\u03bcm probe" if "sub" in probe_type else "50\\u03bcm probe"
    ax.errorbar(means.index, means.values, yerr=sems.values,
                marker=marker, capsize=4, linewidth=2, markersize=7,
                label=label, color=color)

ax.set_xlabel("Days Post-Implantation")
ax.set_ylabel("Signal-to-Noise Ratio (dB)")
ax.set_title("Neural Signal Quality Over 6 Months")
ax.legend(frameon=True, fancybox=True, shadow=True)
ax.set_xlim(-5, 185)
ax.axhline(y=10, color="gray", linestyle="--", alpha=0.5, label="Usability threshold")
plt.tight_layout()
plt.savefig(os.path.join(FIGURES_DIR, "figure_1.png"), dpi=150, bbox_inches="tight", facecolor="white")
plt.close()

# ── Figure 3: Histology comparison (grouped bar chart) ──
fig, axes = plt.subplots(1, 3, figsize=(14, 5))

metrics = [
    ("glial_scar_thickness_um", "Glial Scar Thickness (\\u03bcm)", axes[0]),
    ("neuron_density_per_mm2", "Neuron Density (per mm\\u00b2)", axes[1]),
    ("tissue_damage_score", "Tissue Damage Score", axes[2]),
]

colors = {"sub_25um": "#2563eb", "large_50um": "#dc2626"}

for col, ylabel, ax in metrics:
    for i, (probe_type, grp) in enumerate(histology_df.groupby("probe_type")):
        label = "Sub-25\\u03bcm" if "sub" in probe_type else "50\\u03bcm"
        mean_val = grp[col].mean()
        sem_val = grp[col].sem()
        ax.bar(i, mean_val, yerr=sem_val, capsize=5, color=colors[probe_type],
               label=label, width=0.6, alpha=0.85, edgecolor="white", linewidth=1.5)
    ax.set_ylabel(ylabel)
    ax.set_xticks([0, 1])
    ax.set_xticklabels(["Sub-25\\u03bcm", "50\\u03bcm"])
    ax.set_title(ylabel.split("(")[0].strip())

axes[0].legend(frameon=True)
plt.suptitle("Post-Mortem Histological Analysis (Day 180)", fontsize=13, fontweight="bold", y=1.02)
plt.tight_layout()
plt.savefig(os.path.join(FIGURES_DIR, "figure_2.png"), dpi=150, bbox_inches="tight", facecolor="white")
plt.close()

# ── Figure 4: Impedance % change from baseline ──
fig, ax = plt.subplots(figsize=(10, 6))

for probe_type, color in [("sub_25um", "#2563eb"), ("large_50um", "#dc2626")]:
    grp = impedance_df[impedance_df["probe_type"] == probe_type]
    baseline = grp[grp["day"] == 1].groupby("animal_id")["impedance_kohm"].first()
    pct_changes = []
    days = sorted(grp["day"].unique())
    for day in days:
        day_vals = grp[grp["day"] == day].set_index("animal_id")["impedance_kohm"]
        pct = ((day_vals - baseline) / baseline * 100)
        pct_changes.append({"day": day, "mean": pct.mean(), "sem": pct.sem()})
    pct_df = pd.DataFrame(pct_changes)
    label = "Sub-25\\u03bcm" if "sub" in probe_type else "50\\u03bcm"
    ax.fill_between(pct_df["day"], pct_df["mean"] - pct_df["sem"],
                     pct_df["mean"] + pct_df["sem"], alpha=0.15, color=color)
    ax.plot(pct_df["day"], pct_df["mean"], marker="o", linewidth=2, color=color,
            label=label, markersize=6)

ax.set_xlabel("Days Post-Implantation")
ax.set_ylabel("Impedance Change from Baseline (%)")
ax.set_title("Impedance Drift: Sub-25\\u03bcm vs 50\\u03bcm Probes")
ax.legend(frameon=True, fancybox=True, shadow=True)
ax.set_xlim(-5, 185)
plt.tight_layout()
plt.savefig(os.path.join(FIGURES_DIR, "figure_3.png"), dpi=150, bbox_inches="tight", facecolor="white")
plt.close()

# ── Statistical Tests ──
print("STATISTICAL ANALYSIS")
print("=" * 60)

# Day 180 impedance comparison
small_180 = impedance_df[(impedance_df["probe_type"] == "sub_25um") & (impedance_df["day"] == 180)]["impedance_kohm"]
large_180 = impedance_df[(impedance_df["probe_type"] == "large_50um") & (impedance_df["day"] == 180)]["impedance_kohm"]
t_imp, p_imp = stats.ttest_ind(small_180, large_180)
print(f"\\nImpedance at Day 180:")
print(f"  Sub-25um: {small_180.mean():.1f} +/- {small_180.sem():.1f} kohm (n={len(small_180)})")
print(f"  50um:     {large_180.mean():.1f} +/- {large_180.sem():.1f} kohm (n={len(large_180)})")
print(f"  t-test: t={t_imp:.3f}, p={p_imp:.2e} {'***' if p_imp < 0.001 else '**' if p_imp < 0.01 else '*' if p_imp < 0.05 else 'ns'}")

# SNR at Day 180
small_snr = impedance_df[(impedance_df["probe_type"] == "sub_25um") & (impedance_df["day"] == 180)]["snr_db"]
large_snr = impedance_df[(impedance_df["probe_type"] == "large_50um") & (impedance_df["day"] == 180)]["snr_db"]
t_snr, p_snr = stats.ttest_ind(small_snr, large_snr)
print(f"\\nSNR at Day 180:")
print(f"  Sub-25um: {small_snr.mean():.1f} +/- {small_snr.sem():.1f} dB")
print(f"  50um:     {large_snr.mean():.1f} +/- {large_snr.sem():.1f} dB")
print(f"  t-test: t={t_snr:.3f}, p={p_snr:.2e} {'***' if p_snr < 0.001 else '**' if p_snr < 0.01 else '*' if p_snr < 0.05 else 'ns'}")

# Glial scar
small_scar = histology_df[histology_df["probe_type"] == "sub_25um"]["glial_scar_thickness_um"]
large_scar = histology_df[histology_df["probe_type"] == "large_50um"]["glial_scar_thickness_um"]
t_scar, p_scar = stats.ttest_ind(small_scar, large_scar)
print(f"\\nGlial Scar Thickness:")
print(f"  Sub-25um: {small_scar.mean():.1f} +/- {small_scar.sem():.1f} um")
print(f"  50um:     {large_scar.mean():.1f} +/- {large_scar.sem():.1f} um")
print(f"  t-test: t={t_scar:.3f}, p={p_scar:.2e} {'***' if p_scar < 0.001 else '**' if p_scar < 0.01 else '*' if p_scar < 0.05 else 'ns'}")

# Neuron density
small_neurons = histology_df[histology_df["probe_type"] == "sub_25um"]["neuron_density_per_mm2"]
large_neurons = histology_df[histology_df["probe_type"] == "large_50um"]["neuron_density_per_mm2"]
t_neur, p_neur = stats.ttest_ind(small_neurons, large_neurons)
print(f"\\nNeuron Density:")
print(f"  Sub-25um: {small_neurons.mean():.0f} +/- {small_neurons.sem():.0f} per mm2")
print(f"  50um:     {large_neurons.mean():.0f} +/- {large_neurons.sem():.0f} per mm2")
print(f"  t-test: t={t_neur:.3f}, p={p_neur:.2e} {'***' if p_neur < 0.001 else '**' if p_neur < 0.01 else '*' if p_neur < 0.05 else 'ns'}")

# Effect sizes (Cohen's d)
def cohens_d(g1, g2):
    n1, n2 = len(g1), len(g2)
    pooled_std = np.sqrt(((n1-1)*g1.std()**2 + (n2-1)*g2.std()**2) / (n1+n2-2))
    return (g1.mean() - g2.mean()) / pooled_std

d_imp = cohens_d(small_180, large_180)
d_scar = cohens_d(small_scar, large_scar)
d_snr = cohens_d(small_snr, large_snr)

print(f"\\nEffect Sizes (Cohen's d):")
print(f"  Impedance at 180d: d={d_imp:.2f}")
print(f"  Glial scar: d={d_scar:.2f}")
print(f"  SNR at 180d: d={d_snr:.2f}")

# Impedance stability: % increase from baseline to day 180
small_baseline = impedance_df[(impedance_df["probe_type"] == "sub_25um") & (impedance_df["day"] == 1)]["impedance_kohm"].mean()
large_baseline = impedance_df[(impedance_df["probe_type"] == "large_50um") & (impedance_df["day"] == 1)]["impedance_kohm"].mean()
small_pct = (small_180.mean() - small_baseline) / small_baseline * 100
large_pct = (large_180.mean() - large_baseline) / large_baseline * 100

print(f"\\nImpedance Drift (baseline to day 180):")
print(f"  Sub-25um: +{small_pct:.1f}%")
print(f"  50um:     +{large_pct:.1f}%")

print()
print("STATS_JSON:", json.dumps({
    "data_quality": "sufficient",
    "n_animals_per_group": 5,
    "timepoints": 7,
    "impedance_day180": {
        "sub_25um_mean": round(small_180.mean(), 1),
        "large_50um_mean": round(large_180.mean(), 1),
        "t_statistic": round(t_imp, 3),
        "p_value": float(f"{p_imp:.2e}"),
        "cohens_d": round(d_imp, 2),
    },
    "snr_day180": {
        "sub_25um_mean": round(small_snr.mean(), 1),
        "large_50um_mean": round(large_snr.mean(), 1),
        "p_value": float(f"{p_snr:.2e}"),
        "cohens_d": round(d_snr, 2),
    },
    "glial_scar": {
        "sub_25um_mean": round(small_scar.mean(), 1),
        "large_50um_mean": round(large_scar.mean(), 1),
        "p_value": float(f"{p_scar:.2e}"),
        "cohens_d": round(d_scar, 2),
    },
    "neuron_density": {
        "sub_25um_mean": round(small_neurons.mean(), 0),
        "large_50um_mean": round(large_neurons.mean(), 0),
        "p_value": float(f"{p_neur:.2e}"),
    },
    "impedance_drift_pct": {
        "sub_25um": round(small_pct, 1),
        "large_50um": round(large_pct, 1),
    },
}))
`;

const MOCK_INTERPRETATION = `The data strongly supports the hypothesis that sub-25μm neural probes maintain superior long-term stability compared to larger 50μm probes. Over 180 days, sub-25μm probes showed only a ~38% increase in impedance (119.3→165.2 kΩ) while 50μm probes degraded by ~220% (128.7→410.8 kΩ, p<0.001). Signal-to-noise ratios remained above 15 dB for sub-25μm probes versus falling below 6 dB for larger probes, crossing below the usability threshold by day 90. Post-mortem histology confirmed dramatically reduced tissue trauma: glial scar thickness was 3.9× smaller (11.9 vs 47.6 μm, p<0.001) and neuron density was 58% higher near sub-25μm probes (1860 vs 1164 per mm², p<0.001), with very large effect sizes (Cohen's d > 5) across all metrics. These results provide compelling evidence for the clinical viability of sub-25μm probes for chronic neural interfaces, though validation in larger cohorts with electrophysiological recording quality metrics would strengthen the conclusions.`;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const moduleId = body.module_id;

  // If a module_id is provided, verify it exists
  let resolvedModuleId = moduleId;
  let submissionId: string | null = null;

  if (moduleId) {
    const { data: mod } = await supabase
      .from("modules")
      .select("id")
      .eq("id", moduleId)
      .single();

    if (!mod) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    // Create a mock data submission
    const { data: sub, error: subErr } = await supabase
      .from("data_submissions")
      .insert({
        module_id: moduleId,
        session_id: "demo",
        submitted_by_lab: "Demo Lab",
        submission_type: "results",
        results_summary:
          "Longitudinal impedance monitoring and histological analysis of sub-25μm vs 50μm neural probes over 180 days in 10 animals (n=5 per group).",
        results_data: {
          impedance_csv: IMPEDANCE_CSV,
          histology_csv: HISTOLOGY_CSV,
        },
        file_urls: [],
        notes: "Mock demo data for pipeline validation.",
      })
      .select()
      .single();

    if (subErr || !sub) {
      return NextResponse.json(
        { error: subErr?.message || "Failed to create submission" },
        { status: 500 }
      );
    }
    submissionId = sub.id;
    resolvedModuleId = moduleId;
  } else {
    // No module_id — find any module or fail
    const { data: anyMod } = await supabase
      .from("modules")
      .select("id")
      .limit(1)
      .single();

    if (!anyMod) {
      return NextResponse.json(
        { error: "No modules found. Provide a module_id or create a study first." },
        { status: 400 }
      );
    }
    resolvedModuleId = anyMod.id;

    const { data: sub } = await supabase
      .from("data_submissions")
      .insert({
        module_id: resolvedModuleId,
        session_id: "demo",
        submitted_by_lab: "Demo Lab",
        submission_type: "results",
        results_summary:
          "Longitudinal impedance monitoring and histological analysis of sub-25μm vs 50μm neural probes over 180 days in 10 animals (n=5 per group).",
        results_data: {
          impedance_csv: IMPEDANCE_CSV,
          histology_csv: HISTOLOGY_CSV,
        },
        file_urls: [],
        notes: "Mock demo data for pipeline validation.",
      })
      .select()
      .single();

    if (!sub) {
      return NextResponse.json({ error: "Failed to create submission" }, { status: 500 });
    }
    submissionId = sub.id;
  }

  // Create analysis job
  const { data: job, error: jobErr } = await supabase
    .from("analysis_jobs")
    .insert({
      submission_id: submissionId,
      module_id: resolvedModuleId,
      status: "executing",
      generated_code: ANALYSIS_CODE,
    })
    .select()
    .single();

  if (jobErr || !job) {
    return NextResponse.json(
      { error: jobErr?.message || "Failed to create job" },
      { status: 500 }
    );
  }

  // Fire-and-forget: execute on Modal, then update the job
  runMockAnalysis(job.id, resolvedModuleId).catch((err) =>
    console.error("[analysis/demo] Background error:", err)
  );

  return NextResponse.json({
    job_id: job.id,
    module_id: resolvedModuleId,
    submission_id: submissionId,
    status: "executing",
    message: "Demo analysis started. Poll /api/analysis/status?job_id=" + job.id,
  });
}

async function runMockAnalysis(jobId: string, moduleId: string) {
  try {
    const result = await executeAnalysisCode(
      ANALYSIS_CODE,
      { impedance_csv: IMPEDANCE_CSV, histology_csv: HISTOLOGY_CSV },
      "Mock longitudinal neural probe study data",
      [] // no file attachments needed — data is inline
    );

    if (result.success) {
      // Extract stats JSON
      const statsLine = result.stdout
        .split("\n")
        .reverse()
        .find((l) => l.trim().startsWith("STATS_JSON:"));
      let statsJson = {};
      if (statsLine) {
        try {
          statsJson = JSON.parse(statsLine.slice("STATS_JSON:".length).trim());
        } catch { /* ignore */ }
      }

      // Upload figures to Supabase
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
          figureUrls.push(dataUri); // fallback to inline
        } else {
          const { data: pub } = supabase.storage.from("attachments").getPublicUrl(fileName);
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
          interpretation: MOCK_INTERPRETATION,
          completed_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      console.log(`[analysis/demo] Job ${jobId} completed with ${figureUrls.length} figures`);
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
