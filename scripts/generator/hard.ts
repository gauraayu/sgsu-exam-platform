/**
 * JEE Main–level "Hard" templates: multi-step problems (2–4 concepts each).
 * As with the other templates, the answer is computed from the numbers shown in the question.
 */
import { f, frac, m, num, ratio, txt, type Template } from "./core";

const H = (topic: string, subtopic: string, q: string, sol: string) => ({ topic, subtopic, difficulty: "Hard" as const, q, sol });
const G = 10;
const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
const C = (n: number, k: number): number => (k < 0 || k > n ? 0 : Math.round(fact(n) / (fact(k) * fact(n - k))));
const vec = (x: number[]) => {
  const parts = ["\\hat i", "\\hat j", "\\hat k"].map((u, i) => [x[i], u] as const).filter(([c]) => c !== 0);
  if (!parts.length) return m("\\vec 0");
  return m(parts.map(([c, u], i) => `${c < 0 ? "-" : i ? "+" : ""} ${Math.abs(c) === 1 ? "" : Math.abs(c)}${u}`).join(" ").trim());
};
/** Exact fraction for probabilities with large denominators (e.g. 6^5). */
const bigFrac = (x: number) => {
  for (let d = 1; d <= 100000; d++) {
    const n = Math.round(x * d);
    if (Math.abs(x - n / d) < 1e-12) return m(frac(n, d));
  }
  return f(x);
};
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// =====================================================================================
export const physicsHard: Template[] = [
  (r) => {
    const mass = r.int(2, 10), mu = r.pick([0.25, 0.5]), F = r.int(40, 150);
    const a = (F - mass * G * 0.6 - mu * mass * G * 0.8) / mass;
    if (a <= 0) return null;
    return num(r, H("Laws of Motion", "Friction on an incline", `A block of mass ${mass} kg is pulled up a rough incline of inclination 37° by a force of ${F} N parallel to the incline. If the coefficient of kinetic friction is ${mu}, the acceleration of the block is (${m("g = 10\\,\\text{m/s}^2")}, ${m("\\sin 37^\\circ = 0.6")})`, `${m(`a = \\dfrac{F - mg\\sin\\theta - \\mu mg\\cos\\theta}{m} = \\dfrac{${F} - ${f(mass * 6)} - ${f(mu * mass * 8)}}{${mass}} = ${f(a)}`)} m/s².`), a, [(F - mass * 6) / mass, (F - mass * 6 + mu * mass * 8) / mass, (F - mu * mass * 8) / mass], "m/s²");
  },
  (r) => {
    const m1 = r.int(1, 8), m2 = r.int(1, 8), F = r.int(10, 80), mu = r.pick([0.1, 0.2, 0.3]);
    const T = (m2 * F) / (m1 + m2);
    if ((m1 + m2) * mu * G >= F) return null;
    return num(r, H("Laws of Motion", "Connected bodies", `Blocks of mass ${m1} kg and ${m2} kg, connected by a light string, lie on a horizontal floor (coefficient of friction ${mu} for both). A horizontal force of ${F} N pulls the ${m1} kg block. The tension in the string is (${m("g = 10\\,\\text{m/s}^2")})`, `${m(`a = \\dfrac{F - \\mu(m_1+m_2)g}{m_1+m_2}`)}; for the rear block ${m("T - \\mu m_2 g = m_2 a")} ⇒ ${m(`T = \\dfrac{m_2F}{m_1+m_2} = ${f(T)}`)} N (friction cancels).`), T, [(m1 * F) / (m1 + m2), T - mu * m2 * G, T + mu * m2 * G], "N");
  },
  (r) => {
    const h = r.pick([15, 20, 25, 35, 40, 60, 75]), u = r.pick([10, 20]), th = 30;
    const uy = u * 0.5;
    const t = (uy + Math.sqrt(uy * uy + 2 * G * h)) / G;
    return num(r, H("Kinematics", "Projectile from a height", `A ball is thrown from the top of a tower ${h} m high with speed ${u} m/s at ${th}° above the horizontal. The time after which it hits the ground is (${m("g = 10\\,\\text{m/s}^2")})`, `${m(`-${h} = (${f(uy)})t - 5t^2`)} ⇒ ${m(`5t^2 - ${f(uy)}t - ${h} = 0`)} ⇒ ${m(`t = ${f(t)}`)} s.`), t, [Math.sqrt((2 * h) / G), (2 * uy) / G + Math.sqrt((2 * h) / G) + 0.5, (2 * uy) / G], "s");
  },
  (r) => {
    const m1 = r.int(1, 6), m2 = r.int(1, 6), u = r.int(2, 12), e = r.pick([0, 0.5, 1]);
    const v2 = ((1 + e) * m1 * u) / (m1 + m2);
    return num(r, H("Work, Energy and Power", "Collisions", `A ball of mass ${m1} kg moving at ${u} m/s collides head-on with a stationary ball of mass ${m2} kg. If the coefficient of restitution is ${e}, the velocity of the second ball after the collision is`, `Momentum: ${m(`${m1}(${u}) = ${m1}v_1 + ${m2}v_2`)}; restitution: ${m(`v_2 - v_1 = ${e}(${u})`)} ⇒ ${m(`v_2 = \\dfrac{(1+e)m_1u}{m_1+m_2} = ${f(v2)}`)} m/s.`), v2, [(m1 * u) / (m1 + m2), (2 * m1 * u) / (m1 + m2) === v2 ? u : (2 * m1 * u) / (m1 + m2), (e * m1 * u) / (m1 + m2) || u / 2], "m/s");
  },
  (r) => {
    const m1 = r.int(1, 9), m2 = r.int(1, 9);
    const fracLoss = m2 / (m1 + m2);
    return num(r, H("Work, Energy and Power", "Perfectly inelastic collision", `A ${m1} kg body moving with some speed collides with and sticks to a ${m2} kg body at rest. The fraction of the initial kinetic energy lost is`, `${m(`v = \\dfrac{m_1u}{m_1+m_2}`)}; ${m(`\\dfrac{K_f}{K_i} = \\dfrac{m_1}{m_1+m_2}`)} ⇒ lost ${m(`= \\dfrac{m_2}{m_1+m_2} = ${frac(m2, m1 + m2)}`)}.`), fracLoss, [m1 / (m1 + m2), m2 / m1 === fracLoss ? 0.5 : Math.min(m2 / m1, 0.95), 1 / (m1 + m2)], "", ratio);
  },
  (r) => {
    const mass = r.pick([1, 2, 4]), v = r.pick([2, 4, 5, 6]), k = r.pick([100, 200, 400, 800]), mu = r.pick([0, 0.5]);
    // 1/2 k x^2 + mu m g x - 1/2 m v^2 = 0
    const A = 0.5 * k, Bq = mu * mass * G, Cq = -0.5 * mass * v * v;
    const x = (-Bq + Math.sqrt(Bq * Bq - 4 * A * Cq)) / (2 * A);
    if (mu === 0) return null;
    return num(r, H("Work, Energy and Power", "Spring with friction", `A block of mass ${mass} kg moving at ${v} m/s on a rough horizontal surface (μ = ${mu}) hits a light spring of force constant ${k} N/m. The maximum compression of the spring is (${m("g = 10\\,\\text{m/s}^2")})`, `${m(`\\tfrac12 mv^2 = \\tfrac12 kx^2 + \\mu mg x`)} ⇒ ${m(`${f(A)}x^2 + ${f(Bq)}x - ${f(-Cq)} = 0`)} ⇒ ${m(`x = ${f(x)}`)} m.`), x, [v * Math.sqrt(mass / k), (-Bq + Math.sqrt(Bq * Bq - 4 * A * Cq)) / A, x * 1.5], "m");
  },
  (r) => {
    const bodies = [{ n: "solid sphere", k: 0.4 }, { n: "ring", k: 1 }, { n: "disc", k: 0.5 }, { n: "hollow sphere", k: 2 / 3 }];
    const b = r.pick(bodies), v = r.pick([2, 3, 4, 5, 6, 7]), th = r.pick([30, 37]);
    const s = th === 30 ? 0.5 : 0.6;
    const d = (v * v * (1 + b.k)) / (2 * G * s);
    return num(r, H("Rotational Motion", "Rolling up an incline", `A ${b.n} rolls without slipping with speed ${v} m/s at the foot of an incline of ${th}°${th === 37 ? ` (${m("\\sin37^\\circ = 0.6")})` : ""}. The distance it travels up the incline before stopping is (${m("g = 10\\,\\text{m/s}^2")})`, `${m(`\\tfrac12 mv^2(1 + \\tfrac{I}{mR^2}) = mg\\,d\\sin\\theta`)} ⇒ ${m(`d = \\dfrac{v^2(1+${f(b.k)})}{2g\\sin\\theta} = ${f(d)}`)} m.`), d, [(v * v) / (2 * G * s), ...bodies.filter((x) => x !== b).map((x) => (v * v * (1 + x.k)) / (2 * G * s))], "m");
  },
  (r) => {
    const n1 = r.int(0, 3), n2 = n1 + r.int(1, 3);
    const E = 0.5 * (1 / (1 + n1) - 1 / (1 + n2));
    return num(r, H("Gravitation", "Energy of satellites", `A satellite of mass m orbits the Earth at height ${n1 ? `${n1 === 1 ? "" : n1}R` : "just above the surface (h ≈ 0)"}. The minimum energy needed to shift it to an orbit at height ${n2 === 1 ? "" : n2}R is (R = radius of Earth, g at the surface)`, `${m("E = -\\dfrac{GMm}{2r}")}, ${m("GM = gR^2")} ⇒ ${m(`\\Delta E = \\dfrac{mgR}{2}\\left(\\dfrac{1}{${1 + n1}} - \\dfrac{1}{${1 + n2}}\\right) = ${frac(Math.round(E * 2 * (1 + n1) * (1 + n2)), 2 * (1 + n1) * (1 + n2))}\\,mgR`)}.`), E, [2 * E, (1 / (1 + n1) - 1 / (1 + n2)) / 4, 1 / (1 + n1) - 1 / (1 + n2)], "", (x) => m(`${ratio(x).replace(/\$/g, "")}\\,mgR`));
  },
  (r) => {
    const C1 = r.int(1, 10), C2 = r.int(1, 10), V = r.pick([10, 20, 50, 100]);
    const loss = (C1 * C2 * V * V) / (2 * (C1 + C2));
    return num(r, H("Electrostatic Potential and Capacitance", "Charge sharing", `A ${C1} μF capacitor charged to ${V} V is connected across an uncharged ${C2} μF capacitor. The energy dissipated in the process is`, `${m(`\\Delta U = \\dfrac{C_1C_2V^2}{2(C_1+C_2)} = \\dfrac{${C1}\\times${C2}\\times${V * V}}{2\\times${C1 + C2}}`)} = ${f(loss)} μJ.`), loss, [0.5 * C1 * V * V, (C1 * C1 * V * V) / (2 * (C1 + C2)), loss * 2], "μJ");
  },
  (r) => {
    const E1 = r.pick([2, 4, 6, 12]), E2 = r.pick([2, 4, 6, 8]), r1 = r.pick([1, 2]), r2 = r.pick([1, 2, 4]), R = r.pick([1, 2, 4]);
    const V = (E1 / r1 + E2 / r2) / (1 / r1 + 1 / r2 + 1 / R);
    const I = V / R;
    return num(r, H("Current Electricity", "Cells in parallel", `Two cells of emf ${E1} V and ${E2} V with internal resistances ${r1} Ω and ${r2} Ω are connected in parallel (positive to positive) across a ${R} Ω resistor. The current through the resistor is`, `Node voltage: ${m(`V = \\dfrac{E_1/r_1 + E_2/r_2}{1/r_1 + 1/r_2 + 1/R} = ${f(V)}`)} V ⇒ ${m(`I = V/R = ${f(I)}`)} A.`), I, [(E1 + E2) / (R + r1 + r2), (E1 + E2) / R, Math.abs(E1 - E2) / (r1 + r2) || I * 2], "A");
  },
  (r) => {
    const tri = r.pick([[30, 40, 50], [60, 80, 100], [40, 30, 50], [12, 16, 20], [24, 7, 25], [5, 12, 13]]);
    const [R, X, Z] = tri;
    const V = Z * r.int(2, 10);
    const P = (V / Z) ** 2 * R;
    return num(r, H("Alternating Current", "LCR circuit", `In a series LCR circuit, R = ${R} Ω and the net reactance ${m("|X_L - X_C|")} = ${X} Ω. With an rms supply of ${V} V, the average power consumed is`, `${m(`Z = \\sqrt{${R}^2 + ${X}^2} = ${Z}`)} Ω, ${m(`I = ${V}/${Z} = ${V / Z}`)} A, ${m(`P = I^2R = ${f(P)}`)} W.`), P, [(V * V) / R, (V / Z) * V, (V / Z) ** 2 * X], "W");
  },
  (r) => {
    const f1 = r.pick([10, 20, 30, 40]), f2 = r.pick([-10, -20, 20, 30, 60]), d = r.pick([5, 10, 15]);
    const P = 1 / f1 + 1 / f2 - d / (f1 * f2);
    if (Math.abs(P) < 1e-9) return null;
    const F = 1 / P;
    return num(r, H("Ray Optics", "Separated lenses", `Two thin lenses of focal lengths ${f1} cm and ${f2} cm are placed coaxially ${d} cm apart. The focal length of the combination is`, `${m(`\\dfrac1F = \\dfrac1{f_1} + \\dfrac1{f_2} - \\dfrac{d}{f_1f_2}`)} ⇒ ${m(`F = ${f(F)}`)} cm.`), F, [1 / (1 / f1 + 1 / f2), f1 + f2, (f1 * f2) / (f1 + f2 + d)], "cm");
  },
  (r) => {
    const mu = r.pick([1.5, 1.6, 1.4, 1.25]), t = r.pick([5, 6, 8, 10, 12]), lam = r.pick([500, 600, 400]);
    const n = ((mu - 1) * t * 1000) / lam;
    if (!Number.isInteger(Math.round(n * 1000) / 1000)) return null;
    return num(r, H("Wave Optics", "Fringe shift", `In Young's experiment with light of wavelength ${lam} nm, a thin glass sheet of refractive index ${mu} and thickness ${t} μm is placed in front of one slit. The number of fringes by which the pattern shifts is`, `${m(`N = \\dfrac{(\\mu-1)t}{\\lambda} = \\dfrac{${f(mu - 1)}\\times${t}\\times10^{-6}}{${lam}\\times10^{-9}}`)} = ${f(n)}.`), n, [(mu * t * 1000) / lam, n / 2, n * 2]);
  },
  (r) => {
    const l1 = r.pick([200, 250, 300, 310, 400]), l2 = r.pick([400, 496, 500, 620]), phi = r.pick([1.5, 1.8, 2]);
    const K1 = 1240 / l1 - phi, K2 = 1240 / l2 - phi;
    if (K1 <= 0 || K2 <= 0 || l1 >= l2) return null;
    const ratioV = Math.sqrt(K1 / K2);
    return num(r, H("Dual Nature of Radiation and Matter", "Photoelectric effect", `Light of wavelengths ${l1} nm and ${l2} nm in turn falls on a metal of work function ${phi} eV. The ratio of the maximum speeds of the emitted electrons is (${m("hc = 1240")} eV nm)`, `${m(`K_1 = ${f(K1)}`)} eV, ${m(`K_2 = ${f(K2)}`)} eV; ${m(`v_1/v_2 = \\sqrt{K_1/K_2} = ${f(ratioV)}`)}.`), ratioV, [K1 / K2, Math.sqrt(l2 / l1), l2 / l1]);
  },
  (r) => {
    const n = r.pick([0.5, 1, 2]), T = r.pick([300, 400, 500]), k = r.pick([2, 4, 8]);
    const W = n * 8.3 * T * Math.log(k);
    return num(r, H("Thermodynamics", "Isothermal work", `${n} mol of an ideal gas expands isothermally and reversibly at ${T} K to ${k} times its volume. The work done by the gas is (R = 8.3 J mol⁻¹ K⁻¹, ln 2 = 0.693)`, `${m(`W = nRT\\ln\\dfrac{V_2}{V_1} = ${n}\\times8.3\\times${T}\\times${f(Math.log(k))}`)} = ${f(Math.round(W))} J.`), Math.round(W), [Math.round(n * 8.3 * T * (k - 1)), Math.round(n * 8.3 * T), Math.round(W / 2.303)], "J");
  },
  (r) => {
    const g = r.pick([{ s: "5/3", v: 5 / 3 }, { s: "7/5", v: 1.4 }, { s: "3/2", v: 1.5 }]), k = r.pick([2, 4, 8, 16, 32]), T1 = r.pick([300, 400]);
    const T2 = T1 * Math.pow(k, g.v - 1);
    return num(r, H("Thermodynamics", "Adiabatic process", `An ideal gas (${m(`\\gamma = ${g.s}`)}) at ${T1} K is compressed adiabatically to ${m(frac(1, k))} of its volume. Its final temperature is`, `${m(`TV^{\\gamma-1} = \\text{const} \\Rightarrow T_2 = T_1(${k})^{${f(g.v - 1)}}`)} = ${f(T2)} K.`), T2, [T1 * k, T1 * Math.pow(k, g.v), T1 * Math.pow(k, 1 / g.v)], "K");
  },
  (r) => {
    const mw = r.pick([100, 200, 300, 400, 500]), T = r.pick([40, 50, 60, 80, 90]), mi = r.pick([20, 25, 40, 50, 80, 100]);
    const heatAvail = mw * T, needed = mi * 80;
    if (heatAvail <= needed) return null;
    const Tf = (heatAvail - needed) / (mw + mi);
    return num(r, H("Thermal Properties of Matter", "Calorimetry with phase change", `${mi} g of ice at 0 °C is added to ${mw} g of water at ${T} °C. Neglecting heat losses, the final temperature is (latent heat of fusion 80 cal/g, specific heat of water 1 cal g⁻¹ °C⁻¹)`, `Heat to melt ice ${m(`= ${mi}\\times80 = ${needed}`)} cal < ${heatAvail} cal available. ${m(`${mw}(${T} - T) = ${needed} + ${mi}T`)} ⇒ ${m(`T = ${f(Tf)}`)} °C.`), Tf, [(mw * T) / (mw + mi), (heatAvail - needed) / mw, (heatAvail + needed) / (mw + mi)], "°C");
  },
  (r) => {
    const opts = [
      { x: "A/2", s: "\\tfrac12" },
      { x: "A/\\sqrt2", s: "\\tfrac{1}{\\sqrt2}" },
      { x: "\\tfrac{\\sqrt3}{2}A", s: "\\tfrac{\\sqrt3}{2}" },
    ];
    const o = r.pick(opts);
    const T = r.pick([2, 3, 4, 6, 12, 24]);
    // sin(ωt)=1/2 → ωt=π/6 → t=T/12; 1/√2 → T/8; √3/2 → π/3 → T/6
    const t = o.x === "A/2" ? T / 12 : o.x.startsWith("A/") ? T / 8 : T / 6;
    const lbl = o.x === "A/2" ? "T/12" : o.x.startsWith("A/") ? "T/8" : "T/6";
    return num(r, H("Oscillations", "Phase in SHM", `A particle executes SHM with period ${T} s. The minimum time it takes to go from the mean position to ${m(`x = ${o.x}`)} (A = amplitude) is`, `${m("x = A\\sin\\omega t")}: ${m(`\\sin\\omega t = ${o.s}`)} ⇒ ${m(`t = ${lbl}`)} = ${f(t)} s.`), t, [T / 4, T / 6 === t ? T / 12 : T / 6, T / 8 === t ? T / 3 : T / 8], "s");
  },
  (r) => {
    const mass = r.pick([1, 2, 4]), q = r.pick([1, 2]), B = r.pick([0.5, 1, 2]), v = r.pick([10, 20, 40]), th = r.pick([30, 60]);
    // pitch = 2π m v cosθ / (qB) → coefficient of π
    const pitch = (2 * mass * v * Math.cos((th * Math.PI) / 180)) / (q * B);
    return num(r, H("Moving Charges and Magnetism", "Helical motion", `A particle of mass ${mass} mg and charge ${q} μC enters a uniform magnetic field of ${B} T with speed ${v} m/s at ${th}° to the field. The pitch of its helical path is`, `${m(`p = v\\cos\\theta\\cdot\\dfrac{2\\pi m}{qB} = \\dfrac{2\\pi(${mass}\\times10^{-6})(${v}\\cos${th}^\\circ)}{${q}\\times10^{-6}\\times${B}}`)} = ${m(`${f(pitch)}\\pi`)} m.`), pitch, [(2 * mass * v * Math.sin((th * Math.PI) / 180)) / (q * B), (mass * v) / (q * B), pitch * 2], "", (x) => `${m(`${f(x)}\\pi`)} m`);
  },
  (r) => {
    const L = r.pick([0.1, 0.2, 0.5, 1, 2]), E = r.pick([6, 10, 12, 20, 24]), R = r.pick([2, 4, 5, 10]);
    const U = 0.5 * L * (E / R) ** 2;
    return num(r, H("Electromagnetic Induction", "Energy in an inductor", `An inductor of ${L} H and a resistor of ${R} Ω are connected in series to an ideal ${E} V battery. The energy stored in the inductor in the steady state is`, `Steady current ${m(`I = E/R = ${f(E / R)}`)} A; ${m(`U = \\tfrac12 LI^2 = ${f(U)}`)} J.`), U, [L * (E / R) ** 2, 0.5 * L * (E / R), 0.5 * L * E * E], "J");
  },
  (r) => {
    const A0 = r.pick([800, 1600, 3200, 6400]), n = r.int(2, 5), T = r.pick([3, 5, 8, 10]);
    const Af = A0 / 2 ** n;
    return num(r, H("Nuclei", "Activity", `The activity of a radioactive sample falls from ${A0} counts/s to ${Af} counts/s in ${n * T} minutes. Its half-life is`, `${m(`${A0}/${Af} = 2^{${n}}`)} ⇒ ${n} half-lives in ${n * T} min ⇒ ${m(`T_{1/2} = ${T}`)} min.`), T, [n * T, (n * T) / (n + 1), T * 2], "min");
  },
];

// =====================================================================================
export const chemistryHard: Template[] = [
  (r) => {
    const ratioSA = r.pick([[1, "0"], [2, "0.30"], [10, "1"], [0.5, "-0.30"], [3, "0.48"], [5, "0.70"]] as const), pKa = r.pick([4.74, 4.2, 3.75, 9.25, 5]);
    const [ratioV, logv] = ratioSA;
    const pH = Number((pKa + Number(logv)).toFixed(2));
    const acidName = pKa > 7 ? "NH_4^+/NH_3 (as acid/base pair)" : "acetic acid/sodium acetate type";
    void acidName;
    return num(r, H("Equilibrium", "Buffer solutions", `A buffer contains a weak acid (${m(`pK_a = ${pKa}`)}) and its sodium salt in the molar ratio salt : acid = ${ratioV < 1 ? "1 : 2" : `${ratioV} : 1`}. Its pH is (log 2 = 0.30, log 3 = 0.48, log 5 = 0.70)`, `Henderson equation: ${m(`pH = pK_a + \\log\\dfrac{[\\text{salt}]}{[\\text{acid}]} = ${pKa} + (${logv})`)} = ${f(pH)}.`), pH, [Number((pKa - Number(logv)).toFixed(2)) === pH ? pH + 1 : Number((pKa - Number(logv)).toFixed(2)), Number((pKa + 2 * Number(logv) + 0.3).toFixed(2)), Number((14 - pH).toFixed(2))]);
  },
  (r) => {
    const Va = r.pick([50, 100, 200]), Ma = r.pick([0.1, 0.2]), Vb = r.pick([50, 100, 150]), Mb = r.pick([0.1, 0.2]);
    const nA = Va * Ma, nB = Vb * Mb;
    if (nA === nB) return null;
    const excess = Math.abs(nA - nB) / (Va + Vb);
    const pX = -Math.log10(excess);
    const pH = Number((nA > nB ? pX : 14 - pX).toFixed(2));
    return num(r, H("Equilibrium", "Mixing strong acid and base", `${Va} mL of ${Ma} M HCl is mixed with ${Vb} mL of ${Mb} M NaOH. The pH of the resulting solution is`, `Millimoles: HCl ${f(nA)}, NaOH ${f(nB)} ⇒ excess ${nA > nB ? m("H^+") : m("OH^-")} ${f(Math.abs(nA - nB))} mmol in ${Va + Vb} mL ⇒ ${m(`${f(excess, )}`)} M ⇒ pH = ${f(pH)}.`), pH, [Number((14 - pH).toFixed(2)), Number((-Math.log10(Math.abs(nA - nB) / 1000)).toFixed(2)), 7]);
  },
  (r) => {
    const E0 = r.pick([1.1, 0.46, 1.56, 0.78, 2.71]), n = r.pick([1, 2]), logQ = r.pick([1, 2, -1, -2, 3]);
    const E = Number((E0 - (0.059 / n) * logQ).toFixed(4));
    return num(r, H("Electrochemistry", "Nernst equation", `For a cell reaction involving ${n} electron(s), ${m(`E^\\circ_{cell} = ${E0}`)} V and the reaction quotient Q = ${m(`10^{${logQ}}`)} at 298 K. The cell emf is`, `${m(`E = E^\\circ - \\dfrac{0.059}{n}\\log Q = ${E0} - \\dfrac{0.059}{${n}}(${logQ})`)} = ${f(E)} V.`), E, [Number((E0 + (0.059 / n) * logQ).toFixed(4)), Number((E0 - 0.059 * logQ * n).toFixed(4)), E0], "V");
  },
  (r) => {
    const k = r.pick([[2, 0.301], [3, 0.477], [4, 0.602]] as const), T1 = 300, T2 = r.pick([310, 320]);
    const [kr, lg] = k;
    const Ea = (2.303 * 8.314 * lg * T1 * T2) / (T2 - T1) / 1000;
    return num(r, H("Chemical Kinetics", "Arrhenius equation", `The rate constant of a reaction becomes ${kr} times when the temperature rises from ${T1} K to ${T2} K. The activation energy is (R = 8.314 J mol⁻¹ K⁻¹, log ${kr} = ${lg})`, `${m(`\\log\\dfrac{k_2}{k_1} = \\dfrac{E_a}{2.303R}\\left(\\dfrac{T_2 - T_1}{T_1T_2}\\right)`)} ⇒ ${m(`E_a = ${f(Ea)}`)} kJ/mol.`), Ea, [Ea / 2.303, Ea * 2, (8.314 * lg * T1 * T2) / (T2 - T1) / 1000], "kJ/mol");
  },
  (r) => {
    const x = r.pick([[90, 1], [99, 2], [99.9, 3], [75, 0.602], [50, 0.301]] as const), k = r.pick([0.0231, 0.0693, 0.2303, 0.1, 0.05]);
    const [pct, lg] = x;
    const t = (2.303 / k) * lg;
    return num(r, H("Chemical Kinetics", "First-order integrated rate law", `A first-order reaction has k = ${k} min⁻¹. The time required for ${pct}% completion is (log 2 = 0.301)`, `${m(`t = \\dfrac{2.303}{k}\\log\\dfrac{100}{100 - ${pct}} = \\dfrac{2.303}{${k}}\\times${lg}`)} = ${f(t)} min.`), t, [0.693 / k, (2.303 / k) * (lg + 1), t / 2], "min");
  },
  (r) => {
    const w = r.pick([2, 3, 5, 6, 9, 10, 12, 18]), W = r.pick([100, 200, 250, 500]), Kb = r.pick([0.52, 2.53, 1.86]), M = r.pick([60, 90, 120, 180, 342]);
    const dT = (Kb * w * 1000) / (M * W);
    return num(r, H("Solutions", "Molar mass from colligative data", `Dissolving ${w} g of a non-volatile non-electrolyte in ${W} g of a solvent (${m(`K_b = ${Kb}`)} K kg mol⁻¹) raises its boiling point by ${f(dT)} K. The molar mass of the solute is`, `${m(`M = \\dfrac{K_b\\,w\\times1000}{\\Delta T_b\\,W} = \\dfrac{${Kb}\\times${w}\\times1000}{${f(dT)}\\times${W}}`)} = ${M} g/mol.`), M, [M / 2, M * 2, Math.round((Kb * w) / (dT * W) * 100) / 100 || M + 18], "g/mol");
  },
  (r) => {
    const salt = r.pick([{ s: "MgCl_2", n: 3 }, { s: "K_2SO_4", n: 3 }, { s: "NaCl", n: 2 }, { s: "AlCl_3", n: 4 }, { s: "K_3[Fe(CN)_6]", n: 4 }]), alpha = r.pick([0.5, 0.6, 0.8, 0.9]), mol = r.pick([0.1, 0.2, 0.5]);
    const i = 1 + (salt.n - 1) * alpha;
    const dT = Number((i * 1.86 * mol).toFixed(4));
    return num(r, H("Solutions", "Van 't Hoff factor", `A ${mol} molal aqueous solution of ${m(salt.s)} is ${alpha * 100}% dissociated. The depression in its freezing point is (${m("K_f = 1.86")} K kg mol⁻¹)`, `${m(`i = 1 + (n-1)\\alpha = 1 + ${salt.n - 1}(${alpha}) = ${f(i)}`)}; ${m(`\\Delta T_f = iK_fm = ${f(dT)}`)} K.`), dT, [Number((1.86 * mol).toFixed(4)), Number((salt.n * 1.86 * mol).toFixed(4)), Number(((1 + salt.n * alpha) * 1.86 * mol).toFixed(4))], "K");
  },
  (r) => {
    const a = r.int(2, 6), b = r.int(2, 6), x = r.pick([1, 1.5, 0.5]);
    if (x >= Math.min(a, b)) return null;
    const K = (4 * x * x) / ((a - x) * (b - x));
    return num(r, H("Equilibrium", "Equilibrium constant", `${a} mol of ${m("H_2")} and ${b} mol of ${m("I_2")} are heated in a closed vessel. At equilibrium, ${f(2 * x)} mol of HI is present. ${m("K_c")} for ${m("H_2 + I_2 \\rightleftharpoons 2HI")} is`, `At equilibrium: ${m(`H_2 = ${f(a - x)}`)}, ${m(`I_2 = ${f(b - x)}`)}, HI = ${f(2 * x)} (volume cancels) ⇒ ${m(`K_c = \\dfrac{(${f(2 * x)})^2}{${f(a - x)}\\times${f(b - x)}}`)} = ${f(K)}.`), K, [(2 * x) / ((a - x) * (b - x)), (x * x) / ((a - x) * (b - x)), (4 * x * x) / (a * b)]);
  },
  (r) => {
    const cC = -r.pick([393, 394, 393.5]), cH = -r.pick([286, 285.8, 285]), cM = -r.pick([890, 891, 890.3]);
    const dfH = Number((cC + 2 * cH - cM).toFixed(1));
    return num(r, H("Thermodynamics", "Hess's law", `The enthalpies of combustion of C(graphite), ${m("H_2(g)")} and ${m("CH_4(g)")} are ${cC}, ${cH} and ${cM} kJ/mol. The enthalpy of formation of ${m("CH_4")} is`, `${m("\\Delta_fH(CH_4) = \\Delta_cH(C) + 2\\Delta_cH(H_2) - \\Delta_cH(CH_4)")} = ${m(`${cC} + 2(${cH}) - (${cM})`)} = ${f(dfH)} kJ/mol.`), dfH, [Number((cC + cH - cM).toFixed(1)), Number((cM - cC - 2 * cH).toFixed(1)), Number((cC + 2 * cH + cM).toFixed(1))], "kJ/mol");
  },
  (r) => {
    const hh = r.pick([435, 436]), cc = r.pick([242, 243]), hc = r.pick([431, 432]);
    const dH = hh + cc - 2 * hc;
    return num(r, H("Thermodynamics", "Bond enthalpies", `Bond enthalpies (kJ/mol): H–H = ${hh}, Cl–Cl = ${cc}, H–Cl = ${hc}. The enthalpy change for ${m("H_2(g) + Cl_2(g) \\rightarrow 2HCl(g)")} is`, `${m(`\\Delta H = \\sum(\\text{broken}) - \\sum(\\text{formed}) = ${hh} + ${cc} - 2(${hc})`)} = ${dH} kJ/mol.`), dH, [hh + cc - hc, -dH, 2 * hc - hh], "kJ/mol");
  },
  (r) => {
    const Vfe = r.pick([20, 25, 50, 100]), Mfe = r.pick([0.1, 0.2, 0.5]), Mk = r.pick([0.02, 0.05, 0.1]);
    const V = (Mfe * Vfe) / (5 * Mk);
    return num(r, H("Redox Reactions", "Redox titration", `The volume of ${Mk} M ${m("KMnO_4")} (acidic medium) required to oxidise ${Vfe} mL of ${Mfe} M ${m("FeSO_4")} is`, `${m("MnO_4^- + 5Fe^{2+} + 8H^+ \\rightarrow Mn^{2+} + 5Fe^{3+} + 4H_2O")} ⇒ ${m(`5\\times${Mk}\\times V = ${Mfe}\\times${Vfe}`)} ⇒ V = ${f(V)} mL.`), V, [(Mfe * Vfe) / Mk, (Mfe * Vfe * 5) / Mk, (Mfe * Vfe) / (3 * Mk)], "mL");
  },
  (r) => {
    const c = r.pick([0.01, 0.02, 0.05, 0.001]), Lam0 = r.pick([390.5, 400, 350]), alpha = r.pick([0.02, 0.04, 0.05, 0.1]);
    const Lam = Lam0 * alpha;
    const kappa = (Lam * c) / 1000;
    return num(r, H("Electrochemistry", "Conductance and dissociation", `The conductivity of a ${c} M solution of a weak monobasic acid is ${m(`${f(kappa)}`)} S cm⁻¹. If ${m(`\\Lambda^\\circ_m = ${Lam0}`)} S cm² mol⁻¹, its degree of dissociation is`, `${m(`\\Lambda_m = \\dfrac{1000\\kappa}{c} = ${f(Lam)}`)} S cm² mol⁻¹; ${m(`\\alpha = \\Lambda_m/\\Lambda^\\circ_m = ${f(alpha)}`)}.`), alpha, [alpha * 10, Lam / 1000, alpha * alpha]);
  },
  (r) => {
    const cell = r.pick([{ n: "face-centred cubic", Z: 4 }, { n: "body-centred cubic", Z: 2 }, { n: "simple cubic", Z: 1 }]), M = r.pick([23, 27, 39, 56, 63.5, 108]), a = r.pick([300, 350, 400, 410, 500]);
    const rho = (cell.Z * M) / ((a * 1e-10) ** 3 * 6.022e23);
    return num(r, H("The Solid State", "Density of unit cell", `A metal (molar mass ${M} g/mol) crystallises in a ${cell.n} lattice with edge length ${a} pm. Its density is (${m("N_A = 6.022\\times10^{23}")})`, `${m(`\\rho = \\dfrac{ZM}{a^3N_A} = \\dfrac{${cell.Z}\\times${M}}{(${a}\\times10^{-10})^3\\times6.022\\times10^{23}}`)} = ${f(rho)} g/cm³.`), rho, [rho * 2, rho / 2, cell.Z === 4 ? rho / 4 : rho * 4], "g/cm³");
  },
  (r) => {
    const ion = r.pick([{ s: "Fe^{3+}", n: 5 }, { s: "Mn^{2+}", n: 5 }, { s: "Cr^{3+}", n: 3 }, { s: "Cu^{2+}", n: 1 }, { s: "Ni^{2+}", n: 2 }, { s: "Co^{2+}", n: 3 }, { s: "Ti^{3+}", n: 1 }, { s: "Fe^{2+}", n: 4 }, { s: "V^{3+}", n: 2 }, { s: "Zn^{2+}", n: 0 }]);
    const mu = Math.sqrt(ion.n * (ion.n + 2));
    const show = (x: number) => `${x.toFixed(2)} BM`;
    return num(r, H("The d- and f-Block Elements", "Magnetic moment", `The spin-only magnetic moment of ${m(ion.s)} (free ion) is`, `${m(ion.s)} has ${ion.n} unpaired electron(s): ${m(`\\mu = \\sqrt{n(n+2)} = ${mu.toFixed(2)}`)} BM.`), mu, [1, 2, 3, 4, 5].filter((k) => k !== ion.n).map((k) => Math.sqrt(k * (k + 2))), "", show);
  },
  (r) => {
    const items: [string, number][] = [
      ["[Co(NH_3)_4Cl_2]^+", 2], ["[Pt(NH_3)_2Cl_2]", 2], ["[Co(NH_3)_3Cl_3]", 2], ["[Ni(CO)_4]", 0], ["[Co(en)_2Cl_2]^+", 2], ["[Pt(NH_3)_4]^{2+}", 0], ["[Ma_2b_2c_2]\\text{ (octahedral)}", 5], ["[Ma_3b_3]\\text{ (octahedral)}", 2],
    ];
    const [cmp, n] = r.pick(items);
    return num(r, H("Coordination Compounds", "Geometrical isomerism", `The number of geometrical isomers of ${m(cmp)} is`, `Arranging the ligands in the given geometry (cis/trans, fac/mer) gives ${n}.`), n, [n + 1, n + 2, n === 0 ? 3 : n - 1]);
  },
  (r) => {
    const items: [string, number, string][] = [
      ["CH_3CH(OH)CH(OH)CH_3", 3, "2 chiral centres, one meso form"], ["CH_3CHClCH_2CH_3", 2, "1 chiral centre"], ["CH_3CH(OH)COOH", 2, "1 chiral centre (lactic acid)"], ["HOOC-CH(OH)-CH(OH)-COOH", 3, "tartaric acid: d, l and meso"],
      ["CH_3CHBrCHClCH_3", 4, "2 different chiral centres"], ["CH_3CH=CHCH_3", 2, "cis and trans"], ["CH_3CH=CH-CH(Cl)CH_3", 4, "one C=C (cis/trans) × one chiral centre"], ["C_6H_5CH(CH_3)Cl", 2, "1 chiral centre"],
    ];
    const [x, n, why] = r.pick(items);
    return num(r, H("Organic Chemistry – Basic Principles", "Stereoisomerism", `The total number of stereoisomers of ${m(x)} is`, `${why} ⇒ ${n}.`), n, [n + 1, n * 2, n === 2 ? 1 : n - 1]);
  },
  (r) => {
    const a = r.int(0, 2), b = r.int(0, 2), ka = r.pick([2, 3]), kb = r.pick([2, 3]);
    const fa = ka ** a, fb = kb ** b;
    return num(r, H("Chemical Kinetics", "Rate law from data", `For ${m("A + B \\rightarrow")} products, increasing [A] ${ka} times (B fixed) increases the rate ${fa} time(s), and increasing [B] ${kb} times (A fixed) increases the rate ${fb} time(s). The overall order of the reaction is`, `Order in A: ${m(`${ka}^x = ${fa} \\Rightarrow x = ${a}`)}; in B: ${m(`${kb}^y = ${fb} \\Rightarrow y = ${b}`)} ⇒ overall ${a + b}.`), a + b, [a + b + 1, Math.abs(a - b) === a + b ? a + b + 2 : Math.abs(a - b), a * b === a + b ? 4 : a * b]);
  },
  (r) => {
    const n2 = r.int(3, 6), n1 = r.pick([1, 2]);
    if (n2 <= n1) return null;
    const lines = ((n2 - n1) * (n2 - n1 + 1)) / 2;
    return num(r, H("Structure of Atom", "Spectral lines", `Electrons in a sample of hydrogen atoms are excited to n = ${n2}. The maximum number of spectral lines emitted as they return to n = ${n1} is`, `${m(`\\dfrac{(n_2-n_1)(n_2-n_1+1)}{2} = \\dfrac{${n2 - n1}\\times${n2 - n1 + 1}}{2}`)} = ${lines}.`), lines, [n2 - n1, (n2 * (n2 - 1)) / 2 === lines ? lines + 2 : (n2 * (n2 - 1)) / 2, lines + 1]);
  },
  (r) => {
    const n1 = r.pick([1, 2]), n2 = n1 + r.int(1, 3);
    const inv = 1.097e7 * (1 / (n1 * n1) - 1 / (n2 * n2));
    const lam = 1e9 / inv;
    return num(r, H("Structure of Atom", "Rydberg formula", `The wavelength of the photon emitted in the transition n = ${n2} → n = ${n1} of a hydrogen atom is (${m("R_H = 1.097\\times10^7")} m⁻¹)`, `${m(`\\dfrac1\\lambda = R_H\\left(\\dfrac{1}{${n1 * n1}} - \\dfrac{1}{${n2 * n2}}\\right)`)} ⇒ ${m(`\\lambda = ${f(Math.round(lam * 10) / 10)}`)} nm.`), Math.round(lam * 10) / 10, [Math.round(1e9 / (1.097e7 / (n1 * n1)) * 10) / 10, Math.round(lam * 20) / 10, Math.round(lam * 5) / 10], "nm");
  },
  (r) => {
    const g = r.pick([{ tex: "O_2", M: 32 }, { tex: "CO_2", M: 44 }, { tex: "N_2", M: 28 }, { tex: "SO_2", M: 64 }, { tex: "CH_4", M: 16 }]), P = r.pick([1, 2, 4]), T = r.pick([300, 400, 600]);
    const d = (P * g.M) / (0.082 * T);
    return num(r, H("States of Matter", "Gas density", `The density of ${m(g.tex)} gas at ${P} atm and ${T} K is (R = 0.082 L atm mol⁻¹ K⁻¹)`, `${m(`d = \\dfrac{PM}{RT} = \\dfrac{${P}\\times${g.M}}{0.082\\times${T}}`)} = ${f(d)} g/L.`), d, [(P * 0.082 * T) / g.M, (g.M * T) / (P * 0.082 * 1000), d * 2], "g/L");
  },
];

// =====================================================================================
export const mathsHard: Template[] = [
  (r) => {
    const n = r.int(3, 20);
    const v = (n * (n - 1)) / 2;
    return num(r, H("Integrals", "Greatest integer function", `The value of ${m(`\\int_0^{${n}} [x]\\,dx`)}, where [x] is the greatest integer function, is`, `On [k, k+1) the integrand is k ⇒ ${m(`\\sum_{k=0}^{${n - 1}} k = ${v}`)}.`), v, [(n * (n + 1)) / 2, (n * n) / 2, v - 1]);
  },
  (r) => {
    const n = r.int(5, 25);
    const s = (n * (n + 1) * (n + 2)) / 3;
    return num(r, H("Sequences and Series", "Sum of products", `The value of ${m(`1\\cdot2 + 2\\cdot3 + 3\\cdot4 + \\cdots + ${n}\\cdot${n + 1}`)} is`, `${m(`\\sum k(k+1) = \\dfrac{n(n+1)(n+2)}{3} = \\dfrac{${n}\\cdot${n + 1}\\cdot${n + 2}}{3}`)} = ${s}.`), s, [(n * (n + 1) * (2 * n + 1)) / 6, (n * (n + 1)) / 2 + (n * (n + 1) * (2 * n + 1)) / 6 + n, (n * (n + 1) * (n + 2)) / 6]);
  },
  (r) => {
    const a = r.int(1, 6), b = r.int(1, 6), c = r.int(1, 6), d = r.int(1, 6);
    const p1 = a / (a + b), p2 = c / (c + d);
    const post = p1 / (p1 + p2);
    return num(r, H("Probability", "Bayes' theorem", `Bag I has ${a} red and ${b} black balls; Bag II has ${c} red and ${d} black balls. A bag is chosen at random and a ball drawn from it is red. The probability that it came from Bag I is`, `${m(`P = \\dfrac{\\tfrac12\\cdot${frac(a, a + b)}}{\\tfrac12\\cdot${frac(a, a + b)} + \\tfrac12\\cdot${frac(c, c + d)}}`)} = ${ratio(post)}.`), post, [p1, 0.5 === post ? p2 : 0.5, (a) / (a + c)], "", ratio);
  },
  (r) => {
    const n = r.int(3, 6), den = r.pick([2, 3, 4, 5, 6]);
    const p = 1 - ((den - 1) / den) ** n;
    return num(r, H("Probability", "At least one success", `The probability of hitting a target in one shot is ${m(frac(1, den))}. The probability of at least one hit in ${n} independent shots is`, `${m(`1 - \\left(${frac(den - 1, den)}\\right)^{${n}} = ${frac(den ** n - (den - 1) ** n, den ** n)}`)}.`), p, [n / den >= 1 ? 1 / den : n / den, ((den - 1) / den) ** n, 1 - 1 / den ** n], "", bigFrac);
  },
  (r) => {
    const a = r.int(-4, 5), b = r.int(-4, 5), c = r.int(-4, 5), d = r.int(-4, 5);
    const tr = a + d, det = a * d - b * c;
    return num(r, H("Matrices and Determinants", "Cayley–Hamilton", `If ${m(`A = \\begin{bmatrix} ${a} & ${b} \\\\ ${c} & ${d} \\end{bmatrix}`)} and ${m("A^2 = \\alpha A + \\beta I")}, then ${m("\\alpha + \\beta")} equals`, `Cayley–Hamilton: ${m("A^2 - (\\operatorname{tr}A)A + |A|I = 0")} ⇒ ${m(`\\alpha = ${tr}`)}, ${m(`\\beta = ${-det}`)} ⇒ ${tr - det}.`), tr - det, [tr + det, -tr - det, tr]);
  },
  (r) => {
    const n = r.pick([2, 3]), d = r.pick([2, 3, -2, 4, 5]);
    const p = (n - 1) ** 2;
    const v = d ** p;
    return num(r, H("Matrices and Determinants", "Adjoint of adjoint", `If A is a ${n}×${n} matrix with ${m(`|A| = ${d}`)}, then ${m("|\\operatorname{adj}(\\operatorname{adj}A)|")} equals`, `${m(`|\\operatorname{adj}(\\operatorname{adj}A)| = |A|^{(n-1)^2} = (${d})^{${p}}`)} = ${v}.`), v, [d ** (n - 1), d ** n, d ** (2 * (n - 1))]);
  },
  (r) => {
    const a = r.int(1, 6), b = r.int(1, 6), sign = r.pick([1, -1]);
    const k = sign * a * b;
    return txt(r, H("Limits and Derivatives", "1^∞ form", `The value of ${m(`\\lim_{x\\to\\infty}\\left(1 ${sign > 0 ? "+" : "-"} \\dfrac{${a}}{x}\\right)^{${b}x}`)} is`, `${m("1^\\infty")} form: ${m(`e^{\\lim (${sign > 0 ? "" : "-"}${a}/x)(${b}x)} = e^{${k}}`)}.`), m(`e^{${k}}`), [m(`e^{${-k}}`), m(`e^{${sign * (a + b)}}`), m(`e^{${frac(sign * a, b)}}`), m("1"), m(`e^{${2 * k}}`)]);
  },
  (r) => {
    const a = r.int(1, 8), b = r.int(1, 8);
    const v = (a * a) / (2 * b * b);
    return num(r, H("Limits and Derivatives", "Trigonometric limits", `The value of ${m(`\\lim_{x\\to0}\\dfrac{1 - \\cos ${a}x}{${b === 1 ? "" : b * b}x^2}`)} is`, `${m(`1 - \\cos ${a}x = 2\\sin^2\\tfrac{${a}x}{2}`)} ⇒ limit ${m(`= \\dfrac{${a * a}}{2\\cdot${b * b}} = ${frac(a * a, 2 * b * b)}`)}.`), v, [(a * a) / (b * b), a / (2 * b * b), (a * a) / (4 * b * b)], "", ratio);
  },
  (r) => {
    const n = r.int(0, 3), c0 = r.int(1, 6);
    // y' + y/x = x^n ⇒ (xy)' = x^{n+1} ⇒ y = x^{n+1}/(n+2) + C/x
    const Cc = c0 - 1 / (n + 2);
    const y2 = 2 ** (n + 1) / (n + 2) + Cc / 2;
    return num(r, H("Differential Equations", "Linear first-order", `If ${m(`\\dfrac{dy}{dx} + \\dfrac{y}{x} = x^{${n}}`)} (x > 0) and y(1) = ${c0}, then y(2) equals`, `IF = x: ${m(`(xy)' = x^{${n + 1}} \\Rightarrow xy = \\dfrac{x^{${n + 2}}}{${n + 2}} + C`)}; ${m(`C = ${c0} - ${frac(1, n + 2)}`)} ⇒ ${m(`y(2) = ${ratio(y2).replace(/\$/g, "")}`)}.`), y2, [2 ** (n + 1) / (n + 2) + c0 / 2, 2 ** (n + 1) / (n + 2), 2 * c0], "", ratio);
  },
  (r) => {
    const a = r.int(1, 6);
    const A = (16 * a * a) / 3;
    return num(r, H("Application of Integrals", "Area between parabolas", `The area enclosed between the parabolas ${m(`y^2 = ${4 * a}x`)} and ${m(`x^2 = ${4 * a}y`)} is`, `They meet at (0,0) and (${4 * a}, ${4 * a}); ${m(`A = \\dfrac{16a^2}{3}`)} with a = ${a} ⇒ ${m(frac(16 * a * a, 3))}.`), A, [(8 * a * a) / 3, (32 * a * a) / 3, 4 * a * a], "sq units", ratio);
  },
  (r) => {
    const a = r.int(2, 9), b = r.int(1, 8);
    return num(r, H("Application of Derivatives", "Optimisation", `The maximum area of a rectangle inscribed in the ellipse ${m(`\\dfrac{x^2}{${a * a}} + \\dfrac{y^2}{${b * b}} = 1`)} (sides parallel to the axes) is`, `Vertex ${m("(a\\cos\\theta, b\\sin\\theta)")}: area ${m("= 2ab\\sin2\\theta")}, maximum ${m(`2ab = ${2 * a * b}`)}.`), 2 * a * b, [a * b, 4 * a * b, Math.round(Math.PI * a * b)], "sq units");
  },
  (r) => {
    const r1 = r.int(1, 6), r2 = r.int(1, 6), d2 = r.pick([0, 1, 4, 9, 16, 25, 36, 49, 64, 81, 100, 121]);
    const d = Math.sqrt(d2);
    if (d === 0 && r1 === r2) return null;
    const n = d > r1 + r2 ? 4 : d === r1 + r2 ? 3 : d > Math.abs(r1 - r2) ? 2 : d === Math.abs(r1 - r2) ? 1 : 0;
    return num(r, H("Conic Sections", "Common tangents", `Two circles have radii ${r1} and ${r2}, and the distance between their centres is ${d}. The number of common tangents is`, `Compare d = ${d} with ${m(`r_1 + r_2 = ${r1 + r2}`)} and ${m(`|r_1 - r_2| = ${Math.abs(r1 - r2)}`)} ⇒ ${n}.`), n, [0, 1, 2, 3, 4].filter((x) => x !== n));
  },
  (r) => {
    const a1 = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)], a2 = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)];
    const b1 = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)], b2 = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)];
    const nrm = cross(b1, b2);
    const n2 = dot(nrm, nrm);
    if (!n2) return null;
    const num_ = Math.abs(dot([a2[0] - a1[0], a2[1] - a1[1], a2[2] - a1[2]], nrm));
    if (!num_) return null;
    const sq = Math.sqrt(n2);
    const show = (x: number) => (Number.isInteger(sq) ? ratio(x) : m(`\\dfrac{${Math.round(x * sq)}}{\\sqrt{${n2}}}`));
    return num(r, H("Three Dimensional Geometry", "Skew lines", `The shortest distance between the lines ${m("\\vec r")} = ${vec(a1)} + λ(${vec(b1)}) and ${m("\\vec r")} = ${vec(a2)} + μ(${vec(b2)}) is`, `${m(`\\vec b_1\\times\\vec b_2 = (${nrm.join(", ")})`)}; ${m(`d = \\dfrac{|(\\vec a_2 - \\vec a_1)\\cdot(\\vec b_1\\times\\vec b_2)|}{|\\vec b_1\\times\\vec b_2|} = \\dfrac{${num_}}{\\sqrt{${n2}}}`)}.`), num_ / sq, [(num_ + 1) / sq, (num_ + 2) / sq, (2 * num_) / sq], "", show);
  },
  (r) => {
    const a = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)], b = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)], c = [r.int(-3, 3), r.int(-3, 3), r.int(-3, 3)];
    const v = Math.abs(dot(a, cross(b, c)));
    if (!v) return null;
    return num(r, H("Vector Algebra", "Scalar triple product", `The volume of the parallelepiped with coterminous edges ${vec(a)}, ${vec(b)} and ${vec(c)} is`, `${m("V = |[\\vec a\\ \\vec b\\ \\vec c]|")} = |det| = ${v}.`), v, [v / 2 === Math.floor(v / 2) ? v / 2 : v + 1, v * 2, v + 3], "cubic units");
  },
  (r) => {
    const n = r.int(5, 15), k = r.int(2, 5), positive = r.next() < 0.5;
    const v = positive ? C(n - 1, k - 1) : C(n + k - 1, k - 1);
    return num(r, H("Permutations and Combinations", "Distribution of identical objects", `In how many ways can ${n} identical balls be distributed among ${k} distinct boxes ${positive ? "so that every box gets at least one ball" : "(boxes may be empty)"}?`, positive ? `Stars and bars: ${m(`\\binom{n-1}{k-1} = \\binom{${n - 1}}{${k - 1}} = ${v}`)}.` : `Stars and bars: ${m(`\\binom{n+k-1}{k-1} = \\binom{${n + k - 1}}{${k - 1}} = ${v}`)}.`), v, [positive ? C(n + k - 1, k - 1) : C(n - 1, k - 1), k ** n > 1e7 ? v + n : k ** n, C(n, k)]);
  },
  (r) => {
    const n = r.int(3, 10);
    const v = C(2 * n, n);
    return num(r, H("Binomial Theorem", "Sum of squares of coefficients", `The value of ${m(`\\sum_{r=0}^{${n}} \\left({}^{${n}}C_r\\right)^2`)} is`, `Coefficient of ${m(`x^{${n}}`)} in ${m(`(1+x)^{${n}}(1+x)^{${n}}`)} ⇒ ${m(`{}^{${2 * n}}C_{${n}} = ${v}`)}.`), v, [2 ** (2 * n) > 1e6 ? v * 2 : 2 ** (2 * n), 2 ** n * 2 ** n === v ? v + 2 : 2 ** n, C(2 * n, n - 1)]);
  },
  (r) => {
    const den = r.pick([2, 3, 4, 5]);
    const x = 1 / den;
    const s = 1 / (1 - x) ** 2;
    return num(r, H("Sequences and Series", "Arithmetico-geometric series", `The sum ${m(`1 + 2\\left(${frac(1, den)}\\right) + 3\\left(${frac(1, den)}\\right)^2 + 4\\left(${frac(1, den)}\\right)^3 + \\cdots`)} to infinity is`, `${m("\\sum_{k\\ge1} kx^{k-1} = \\dfrac{1}{(1-x)^2}")} with ${m(`x = ${frac(1, den)}`)} ⇒ ${m(frac(den * den, (den - 1) ** 2))}.`), s, [1 / (1 - x), x / (1 - x) ** 2, 2 / (1 - x)], "", ratio);
  },
  (r) => {
    const a = r.pick([[1, 2], [1, 3], [2, 3], [1, 4], [1, 5], [2, 5], [3, 4]] as const), b = r.pick([[1, 3], [1, 7], [1, 2], [2, 7], [1, 8]] as const);
    const ta = a[0] / a[1], tb = b[0] / b[1];
    if (ta * tb === 1) return null;
    const t = (ta + tb) / (1 - ta * tb);
    return num(r, H("Inverse Trigonometric Functions", "Sum of inverse tangents", `The value of ${m(`\\tan\\left(\\tan^{-1}${frac(a[0], a[1])} + \\tan^{-1}${frac(b[0], b[1])}\\right)`)} is`, `${m("\\tan(A+B) = \\dfrac{\\tan A + \\tan B}{1 - \\tan A\\tan B}")} = ${ratio(t)}.`), t, [ta + tb, (ta + tb) / (1 + ta * tb), (ta - tb) / (1 + ta * tb) || 1], "", ratio);
  },
  (r) => {
    const n = r.int(3, 7), mm = r.int(2, 3);
    if (n < mm) return null;
    let s = 0;
    for (let k = 0; k <= mm; k++) s += (-1) ** k * C(mm, k) * (mm - k) ** n;
    return num(r, H("Sets, Relations and Functions", "Onto functions", `The number of onto (surjective) functions from a set with ${n} elements to a set with ${mm} elements is`, `Inclusion–exclusion: ${m(`\\sum_{k=0}^{${mm}}(-1)^k\\binom{${mm}}{k}(${mm}-k)^{${n}} = ${s}`)}.`), s, [mm ** n, mm ** n - mm, C(n, mm) * fact(mm)]);
  },
  (r) => {
    const n = r.pick([5, 7, 9, 11, 13, 15, 17, 19, 21]);
    const v = (n * n - 1) / 12;
    return num(r, H("Statistics", "Variance of natural numbers", `The variance of the first ${n} natural numbers is`, `${m(`\\sigma^2 = \\dfrac{n^2 - 1}{12} = \\dfrac{${n * n - 1}}{12}`)} = ${ratio(v)}.`), v, [(n * n + 1) / 12, (n + 1) / 2, Math.sqrt(v)], "", ratio);
  },
  (r) => {
    const p = r.int(1, 6);
    return num(r, H("Integrals", "Limit as a sum", `The value of ${m(`\\lim_{n\\to\\infty}\\dfrac{1^{${p}} + 2^{${p}} + \\cdots + n^{${p}}}{n^{${p + 1}}}`)} is`, `Riemann sum: ${m(`\\int_0^1 x^{${p}}dx = ${frac(1, p + 1)}`)}.`), 1 / (p + 1), [1 / p, 1, 1 / (p + 2)], "", ratio);
  },
  (r) => {
    const items: [string, string][] = [
      ["\\int_0^{\\pi/2}\\dfrac{\\sin^{n}x}{\\sin^{n}x + \\cos^{n}x}dx", "\\pi/4"], ["\\int_0^{\\pi}\\dfrac{x\\sin x}{1+\\cos^2x}dx", "\\pi^2/4"], ["\\int_0^{\\pi/2}\\ln(\\tan x)\\,dx", "0"], ["\\int_{-1}^{1}\\dfrac{x^3 + |x|}{1}\\,dx", "1"], ["\\int_0^{\\pi/2}\\ln(\\sin x)\\,dx", "-\\tfrac{\\pi}{2}\\ln2"], ["\\int_0^{\\pi}x\\sin x\\,dx", "\\pi"], ["\\int_0^{\\pi/4}\\ln(1+\\tan x)\\,dx", "\\tfrac{\\pi}{8}\\ln2"], ["\\int_0^{2}|x-1|\\,dx", "1"],
    ];
    const [e, v] = r.pick(items);
    return txt(r, H("Integrals", "Properties of definite integrals", `The value of ${m(e)} is`, `Use ${m("\\int_a^b f(x)dx = \\int_a^b f(a+b-x)dx")} (or split at the kink) and add the two forms: ${m(v)}.`), m(v), ["\\pi/4", "\\pi^2/4", "0", "1", "-\\tfrac{\\pi}{2}\\ln2", "\\pi", "\\tfrac{\\pi}{8}\\ln2", "\\pi/2", "2"].map(m));
  },
];
