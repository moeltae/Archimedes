"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function ExperimentRedirect() {
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    router.replace(`/study/${params.id}`);
  }, [router, params.id]);

  return null;
}
