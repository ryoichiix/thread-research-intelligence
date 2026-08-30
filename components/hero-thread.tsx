/*
 * Landing hero centerpiece.
 *
 * One idea, held still: the THREAD mark at the center with threads running out from it and
 * terminating in nodes — the product's premise (a thread that connects what you read) drawn
 * literally, rather than a decorative pattern. Generously spaced and quiet enough to sit above
 * a headline without competing with it.
 *
 * Geometry note: every thread starts on the mark's own stem or crossbar, so the lines read as
 * continuations of the glyph rather than as a halo drawn around it.
 */
export function HeroThread() {
  const threads = [
    { d: "M120 46 C 92 46, 72 62, 58 84", node: 58, nodeY: 84, r: 5, accent: false },
    { d: "M120 46 C 96 30, 74 26, 50 30", node: 50, nodeY: 30, r: 3.5, accent: false },
    { d: "M200 46 C 236 46, 258 60, 274 82", node: 274, nodeY: 82, r: 5, accent: true },
    { d: "M200 46 C 232 28, 262 26, 288 34", node: 288, nodeY: 34, r: 3.5, accent: false },
    { d: "M160 78 C 160 116, 138 138, 104 150", node: 104, nodeY: 150, r: 5, accent: false },
    { d: "M160 78 C 160 120, 186 142, 220 152", node: 220, nodeY: 152, r: 6.5, accent: true },
    { d: "M160 78 C 160 128, 160 154, 160 176", node: 160, nodeY: 176, r: 4, accent: false },
  ];

  return (
    <div className="hero-thread" aria-hidden="true">
      <svg className="hero-thread-svg" viewBox="0 0 340 210" role="presentation">
        {/* Depth rings, barely there — they give the threads somewhere to travel. */}
        <circle className="hero-thread-ring" cx="160" cy="70" r="86" />
        <circle className="hero-thread-ring" cx="160" cy="70" r="128" />

        {threads.map((thread) => (
          <g key={thread.d} className={thread.accent ? "hero-thread-line is-accent" : "hero-thread-line"}>
            <path d={thread.d} />
            <circle cx={thread.node} cy={thread.nodeY} r={thread.r} />
          </g>
        ))}

        {/* The mark itself, at the scale of the original 40x40 glyph multiplied up. */}
        <g className="hero-thread-mark">
          <path d="M120 46h80M120 66h46M160 66v66M136 132h66" />
          <circle cx="120" cy="46" r="6" />
          <circle cx="200" cy="46" r="6" />
          <circle cx="120" cy="66" r="6" />
          <circle cx="160" cy="132" r="6" />
          <circle cx="202" cy="132" r="6" />
        </g>
      </svg>
    </div>
  );
}
