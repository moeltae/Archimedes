import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";

// GET — SSE stream for analysis job status updates
export async function GET(req: NextRequest) {
  const jobId = req.nextUrl.searchParams.get("job_id");

  if (!jobId) {
    return new Response("job_id required", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      const maxPolls = 120; // 2 minutes at 1s intervals
      let polls = 0;

      const poll = async () => {
        if (polls >= maxPolls) {
          send({ status: "timeout", message: "Polling timed out" });
          controller.close();
          return;
        }

        polls++;

        const { data: job, error } = await supabase
          .from("analysis_jobs")
          .select("*")
          .eq("id", jobId)
          .single();

        if (error || !job) {
          send({ status: "error", message: "Job not found" });
          controller.close();
          return;
        }

        send({
          status: job.status,
          retry_count: job.retry_count,
          generated_code: job.generated_code,
          error_message: job.error_message,
          // Include full results on completion
          ...(job.status === "completed" && {
            figure_urls: job.figure_urls,
            output_file_urls: job.output_file_urls,
            statistical_results: job.statistical_results,
            interpretation: job.interpretation,
            execution_stdout: job.execution_stdout,
            execution_duration_ms: job.execution_duration_ms,
          }),
          ...(job.status === "failed" && {
            execution_stderr: job.execution_stderr,
          }),
        });

        // Terminal states — close stream
        if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
          controller.close();
          return;
        }

        // Continue polling
        setTimeout(poll, 1000);
      };

      poll();
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
