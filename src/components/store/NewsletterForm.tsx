"use client";
import { useState } from "react";

export function NewsletterForm({ placeholder, cta, done, code }: { placeholder: string; cta: string; done: string; code?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  return state === "done" ? (
    <p className="text-[15px]" role="status">{done}{code ? <> · <span className="tnum font-semibold">{code}</span></> : null}</p>
  ) : (
    <form
      className="flex gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        const contact = new FormData(e.currentTarget).get("contact");
        const r = await fetch("/api/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact }) });
        const j = await r.json().catch(() => ({}));
        if (r.ok) setState("done"); else { setState("error"); setMsg(j.error ?? "Please check and try again"); }
      }}
    >
      <input name="contact" required className="input" placeholder={placeholder} aria-label={placeholder} autoComplete="email" />
      <button className="btn btn-primary shrink-0" disabled={state === "busy"}>{cta}</button>
      {state === "error" && <p className="sr-only" role="alert">{msg}</p>}
    </form>
  );
}
