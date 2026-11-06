import { saveSettingsForm } from "@/app/admin/(panel)/settings-actions";

export type Field =
  | { name: string; label: string; type?: "text" | "email" | "url" | "textarea"; value: string; help?: string; placeholder?: string }
  | { name: string; label: string; type: "number"; value: number; help?: string }
  | { name: string; label: string; type: "bool"; value: boolean; help?: string }
  | { name: string; label: string; type: "list"; value: string[]; help?: string }
  | { name: string; label: string; type: "select"; value: string; options: string[]; help?: string };

/** Server-rendered settings card posting to the generic settings action. */
export function SettingsForm({ section, title, fields, back, cols = 2, footer }: { section: string; title: string; fields: Field[]; back: string; cols?: 1 | 2 | 3; footer?: React.ReactNode }) {
  const bools = fields.filter((f) => f.type === "bool").map((f) => f.name).join(",");
  return (
    <form action={saveSettingsForm} className="card">
      <input type="hidden" name="__section" value={section} />
      <input type="hidden" name="__back" value={back} />
      <input type="hidden" name="__bools" value={bools} />
      <div className="card-h">{title}<button className="btn btn-primary">Save</button></div>
      <div className={`card-b grid gap-4 ${cols === 1 ? "" : cols === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        {fields.map((f) => {
          const help = f.help && <small className="mt-1 block text-[11px] text-[var(--muted)]">{f.help}</small>;
          if (f.type === "bool") return <label key={f.name} className="flex items-start gap-2 text-[13px]"><input type="checkbox" name={`${f.name}:b`} defaultChecked={f.value} className="mt-0.5" /><span>{f.label}{help}</span></label>;
          if (f.type === "number") return <label key={f.name} className="f"><span>{f.label}</span><input type="number" name={`${f.name}:n`} defaultValue={f.value} className="input" />{help}</label>;
          if (f.type === "list") return <label key={f.name} className="f"><span>{f.label}</span><input name={`${f.name}:l`} defaultValue={f.value.join(", ")} className="input" />{help}</label>;
          if (f.type === "select") return <label key={f.name} className="f"><span>{f.label}</span><select name={f.name} defaultValue={f.value} className="input">{f.options.map((o) => <option key={o}>{o}</option>)}</select>{help}</label>;
          if (f.type === "textarea") return <label key={f.name} className="f sm:col-span-2"><span>{f.label}</span><textarea name={f.name} defaultValue={f.value} className="input" />{help}</label>;
          return <label key={f.name} className="f"><span>{f.label}</span><input type={f.type ?? "text"} name={f.name} defaultValue={f.value} placeholder={f.placeholder} className="input" />{help}</label>;
        })}
      </div>
      {footer}
    </form>
  );
}
