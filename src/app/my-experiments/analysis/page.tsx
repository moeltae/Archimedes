"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AnalysisPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/my-experiments?tab=analysis");
  }, [router]);

  return null;
}
