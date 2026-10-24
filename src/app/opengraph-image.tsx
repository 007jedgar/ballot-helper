import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Ballot Helper: upload your sample ballot, get nonpartisan research on every race, and export your picks.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Inter (SIL Open Font License). Read at build time, when this image is generated.
const [inter, interSemiBold] = await Promise.all(
  ["Inter-400.ttf", "Inter-600.ttf"].map((f) => readFile(join(process.cwd(), "src/app/fonts", f))),
);

const card = (name: string, lines: [string, string][], selected = false, flag = false) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      width: 250,
      padding: 22,
      borderRadius: 16,
      background: "#0f1011",
      border: selected ? "2px solid #5e6ad2" : "2px solid rgba(255,255,255,0.08)",
      boxShadow: selected ? "0 10px 50px -10px rgba(94,106,210,0.7)" : "none",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 22, fontWeight: 600, color: "#f7f8f8" }}>
        {name}
        {flag && (
          <svg width="18" height="18" viewBox="0 0 16 16">
            <path
              fill="#eb5757"
              d="M3 1.75a.75.75 0 0 1 1.5 0V2h7.69a.75.75 0 0 1 .6 1.2L10.94 5.5l1.85 2.3a.75.75 0 0 1-.6 1.2H4.5v5.25a.75.75 0 0 1-1.5 0V1.75Z"
            />
          </svg>
        )}
      </div>
      {selected && (
        <div
          style={{
            display: "flex",
            width: 26,
            height: 26,
            borderRadius: 13,
            background: "#5e6ad2",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16">
            <path d="M3 8.5l3.2 3.2L13 4.5" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}
    </div>
    {lines.map(([label, text]) => (
      <div key={label} style={{ display: "flex", flexDirection: "column", marginTop: 16 }}>
        <div style={{ fontSize: 12, letterSpacing: 1.5, color: "#62666d" }}>{label}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, fontSize: 16, color: "#c9ccd1" }}>
          <div style={{ width: 5, height: 5, borderRadius: 3, background: label === "CRITICISMS" ? "#eb5757" : "#62666d" }} />
          {text}
        </div>
      </div>
    ))}
  </div>
);

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "radial-gradient(ellipse 70% 60% at 50% 0%, rgba(94,106,210,0.32), #08090a 70%)",
          backgroundColor: "#08090a",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <svg width="52" height="52" viewBox="0 0 32 32">
            <rect width="32" height="32" rx="8" fill="#5e6ad2" />
            <rect x="9.5" y="5" width="13" height="15" rx="1.75" fill="#fff" />
            <path d="M12.5 11.6l2.4 2.4 4.6-5" fill="none" stroke="#5e6ad2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="6" y="17.5" width="20" height="9.5" rx="2" fill="#16182b" />
            <rect x="9" y="17.5" width="14" height="1.6" rx=".8" fill="#5e6ad2" opacity=".55" />
          </svg>
          <div style={{ fontSize: 30, fontWeight: 600, color: "#f7f8f8" }}>Ballot Helper</div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", width: 520 }}>
            <div style={{ fontSize: 66, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2, color: "#f7f8f8" }}>
              Know who you&apos;re voting for.
            </div>
            <div style={{ marginTop: 24, fontSize: 26, lineHeight: 1.4, color: "#8a8f98" }}>
              Upload your sample ballot. Get nonpartisan research on every race and measure, compare, and export your picks.
            </div>
          </div>
          <div style={{ display: "flex", gap: 18, marginBottom: 6 }}>
            {card("Candidate A", [["QUALIFICATIONS", "JD, 14 yrs on bench"], ["ENDORSEMENTS", "County bar assoc."]], true)}
            {card("Candidate B", [["QUALIFICATIONS", "Former prosecutor"], ["CRITICISMS", "Conflict of interest"]], false, true)}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: inter, weight: 400, style: "normal" },
        { name: "Inter", data: interSemiBold, weight: 600, style: "normal" },
      ],
    },
  );
}
