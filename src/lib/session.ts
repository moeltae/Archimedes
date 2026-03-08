// Simple session ID for anonymous voting (no auth needed for demo)
export function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("archimedes_session");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("archimedes_session", id);
  }
  return id;
}
