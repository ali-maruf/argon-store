const SIZES = [[7, 17.3, 54.4], [8, 18.1, 57.0], [9, 18.9, 59.5], [10, 19.8, 62.1], [11, 20.6, 64.6], [12, 21.4, 67.2]];

export function RingSizeTable({ locale }: { locale: "en" | "bn" }) {
  return (
    <div>
      <p>{locale === "bn" ? "একটি সুতো আঙুলে পেঁচিয়ে মাপুন, তারপর নিচের টেবিলের সাথে মেলান।" : "Wrap a strip of paper around your finger, mark where it meets, and measure the length in mm. Match it below."}</p>
      <table className="tnum mt-3 w-full text-left text-[14px]">
        <thead><tr className="border-b border-[var(--line)] text-[var(--muted)]"><th className="py-2 font-medium">US size</th><th className="py-2 font-medium">Diameter (mm)</th><th className="py-2 font-medium">Circumference (mm)</th></tr></thead>
        <tbody>{SIZES.map(([s, d, c]) => <tr key={s} className="border-b border-[var(--line)]"><td className="py-2">{s}</td><td>{d}</td><td>{c}</td></tr>)}</tbody>
      </table>
      <p className="mt-3">“Adjustable” rings open to fit sizes 7–12.</p>
    </div>
  );
}
