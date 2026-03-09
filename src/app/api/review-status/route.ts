import { NextRequest } from "next/server";
import { getEdisonTask } from "@/lib/futurehouse";
import { supabase } from "@/lib/supabase";

// GET /api/review-status?id=<study_id>
// SSE endpoint — streams live FutureHouse review progress
export async function GET(req: NextRequest) {
  const studyId = req.nextUrl.searchParams.get("id");
  if (!studyId) {
    return new Response("Missing id", { status: 400 });
  }

  // Look up the study to get its review_task_id
  const { data: study } = await supabase
    .from("experiments")
    .select("id, status, review_task_id, novelty_score, review_explanation")
    .eq("id", studyId)
    .single();

  if (!study) {
    // Study may not be committed yet (race condition) — return a graceful SSE close
    const body = JSON.stringify({ phase: "error", message: "Study not found" });
    return new Response(`data: ${body}\n\ndata: [DONE]\n\n`, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // If already reviewed, return final result immediately
  if (study.status !== "pending_review") {
    const body = JSON.stringify({
      phase: "done",
      status: study.status,
      novelty_score: study.novelty_score,
      answer: study.review_explanation || "",
    });
    return new Response(`data: ${body}\n\ndata: [DONE]\n\n`, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  const taskId = study.review_task_id;
  if (!taskId) {
    const body = JSON.stringify({ phase: "fallback", message: "Using OpenAI fallback..." });
    return new Response(`data: ${body}\n\ndata: [DONE]\n\n`, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }

  // Stream live status from Edison
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      send({ phase: "started", message: "Connecting to FutureHouse OWL agent..." });

      const MAX_POLLS = 60; // 5 min at 5s intervals
      let lastStatus = "";

      for (let i = 0; i < MAX_POLLS; i++) {
        try {
          const result = await getEdisonTask(taskId);

          if (!result) {
            send({ phase: "error", message: "Failed to reach FutureHouse API" });
            break;
          }

          // Send progress update if status changed
          if (result.status !== lastStatus) {
            lastStatus = result.status;

            if (result.status === "queued") {
              send({ phase: "queued", message: "Queued — waiting for OWL agent..." });
            } else if (result.status === "in progress") {
              send({ phase: "searching", message: "OWL agent searching scientific literature..." });
            }
          }

          // Periodic "still working" updates
          if (result.status === "in progress" && i > 0 && i % 3 === 0) {
            const messages = [
              "Scanning published research databases...",
              "Cross-referencing hypothesis against existing literature...",
              "Analyzing precedent in related fields...",
              "Evaluating novelty of proposed approach...",
              "Reviewing citations and prior work...",
            ];
            send({ phase: "searching", message: messages[i % messages.length] });
          }

          if (result.status === "success") {
            const hasSuccessful = result.has_successful_answer ?? false;
            const noveltyScore = hasSuccessful ? 3 : 7;

            send({
              phase: "reviewing",
              message: hasSuccessful
                ? "Prior work found — evaluating significance..."
                : "No strong precedent found — hypothesis appears novel!",
            });

            // Brief pause for the user to read
            await new Promise((r) => setTimeout(r, 1500));

            // Re-check DB to see if background process already updated it
            const { data: updated } = await supabase
              .from("experiments")
              .select("status, novelty_score")
              .eq("id", studyId)
              .single();

            const finalStatus = updated?.status !== "pending_review"
              ? updated?.status
              : (hasSuccessful ? "rejected" : "proposed");
            const finalScore = updated?.novelty_score ?? noveltyScore;

            // Write final status back to DB if still pending
            if (updated?.status === "pending_review") {
              const dbUpdate: Record<string, unknown> = {
                status: finalStatus,
                novelty_score: finalScore,
                review_explanation: (result.answer || "").slice(0, 5000),
              };
              if (finalStatus === "rejected") {
                dbUpdate.rejected_at = new Date().toISOString();
              }
              await supabase
                .from("experiments")
                .update(dbUpdate)
                .eq("id", studyId);
            }

            send({
              phase: "done",
              status: finalStatus,
              novelty_score: finalScore,
              answer: (result.answer || "").slice(0, 500),
            });
            break;
          }

          if (result.status === "fail" || result.status === "cancelled") {
            send({ phase: "error", message: `Review ended: ${result.status}` });
            break;
          }

          // Wait before next poll
          await new Promise((r) => setTimeout(r, 5000));
        } catch {
          send({ phase: "error", message: "Connection error — retrying..." });
          await new Promise((r) => setTimeout(r, 5000));
        }
      }

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
