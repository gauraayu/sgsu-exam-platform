import { f, frac, m, num, ratio, sci, txt, type Item, type Template } from "./core";

const G = 10; // g = 10 m/s² is stated in every question that uses it
const B = (topic: string, subtopic: string, difficulty: "Easy" | "Medium", q: string, sol: string) => ({ topic, subtopic, difficulty, q, sol });

export const physics: Template[] = [
  // ---------------------------------------------------------------- Kinematics
  (r) => {
    const u = r.int(0, 20), a = r.int(1, 6), t = r.int(2, 12);
    const v = u + a * t;
    return num(r, B("Kinematics", "Equations of motion", "Easy", `A car moving with initial velocity ${m(`${u}\\,\\text{m/s}`)} accelerates uniformly at ${m(`${a}\\,\\text{m/s}^2`)}. Its velocity after ${t} s is`, `Using ${m("v = u + at")}: ${m(`v = ${u} + ${a}\\times${t} = ${v}`)} m/s.`), v, [u + a, a * t, u * t + a], "m/s");
  },
  (r) => {
    const u = r.int(0, 15), a = r.int(2, 8), t = r.int(2, 10);
    const s = u * t + 0.5 * a * t * t;
    return num(r, B("Kinematics", "Equations of motion", "Easy", `A body starts with velocity ${m(`${u}\\,\\text{m/s}`)} and moves with uniform acceleration ${m(`${a}\\,\\text{m/s}^2`)}. The distance covered in ${t} s is`, `${m("s = ut + \\tfrac12 at^2")} = ${m(`${u}(${t}) + \\tfrac12(${a})(${t})^2 = ${f(s)}`)} m.`), s, [u * t + a * t * t, 0.5 * a * t * t, u * t + a * t], "m");
  },
  (r) => {
    const u = r.pick([10, 12, 15, 20, 24, 25, 30, 36, 40]), a = r.pick([2, 3, 4, 5, 6, 8]);
    const s = (u * u) / (2 * a);
    return num(r, B("Kinematics", "Equations of motion", "Medium", `A vehicle moving at ${m(`${u}\\,\\text{m/s}`)} applies brakes producing a uniform retardation of ${m(`${a}\\,\\text{m/s}^2`)}. The distance travelled before it stops is`, `${m("v^2 = u^2 - 2as")} with ${m("v=0")}: ${m(`s = \\dfrac{u^2}{2a} = \\dfrac{${u}^2}{2\\times${a}} = ${f(s)}`)} m.`), s, [(u * u) / a, u / a, (u * u) / (4 * a)], "m");
  },
  (r) => {
    const h = r.pick([5, 20, 45, 80, 125, 180, 245, 320, 405, 500]);
    const t = Math.sqrt((2 * h) / G);
    return num(r, B("Kinematics", "Free fall", "Easy", `A stone is dropped from a height of ${h} m. Taking ${m("g = 10\\,\\text{m/s}^2")}, the time taken to reach the ground is`, `${m("h = \\tfrac12 g t^2 \\Rightarrow t = \\sqrt{2h/g}")} = ${m(`\\sqrt{${2 * h}/10} = ${f(t)}`)} s.`), t, [Math.sqrt(h / G), (2 * h) / G, Math.sqrt(h)], "s");
  },
  (r) => {
    const u = r.pick([10, 15, 20, 25, 30, 35, 40, 45, 50, 60]);
    const H = (u * u) / (2 * G);
    return num(r, B("Kinematics", "Vertical motion", "Easy", `A ball is thrown vertically upward with a speed of ${m(`${u}\\,\\text{m/s}`)}. The maximum height reached is (${m("g = 10\\,\\text{m/s}^2")})`, `${m("H = \\dfrac{u^2}{2g}")} = ${m(`\\dfrac{${u * u}}{20} = ${f(H)}`)} m.`), H, [(u * u) / G, u / G, (u * u) / (4 * G)], "m");
  },
  (r) => {
    const u = r.pick([10, 15, 20, 25, 30, 40, 50]), th = r.pick([15, 30, 45, 60, 75]);
    const R = (u * u * Math.sin((2 * th * Math.PI) / 180)) / G;
    return num(r, B("Kinematics", "Projectile motion", "Medium", `A projectile is fired with speed ${m(`${u}\\,\\text{m/s}`)} at ${th}° to the horizontal. Its horizontal range is (${m("g = 10\\,\\text{m/s}^2")})`, `${m("R = \\dfrac{u^2 \\sin 2\\theta}{g}")} = ${m(`\\dfrac{${u * u} \\sin ${2 * th}^\\circ}{10} = ${f(R)}`)} m.`), R, [(u * u) / G, (u * u * Math.sin((th * Math.PI) / 180)) / G, R / 2], "m");
  },
  (r) => {
    const u = r.pick([20, 30, 40, 50, 60]), th = r.pick([30, 45, 60, 90]);
    const s = Math.sin((th * Math.PI) / 180);
    const H = (u * u * s * s) / (2 * G);
    return num(r, B("Kinematics", "Projectile motion", "Medium", `A particle is projected with speed ${m(`${u}\\,\\text{m/s}`)} at an angle of ${th}° with the horizontal. The maximum height attained is (${m("g = 10\\,\\text{m/s}^2")})`, `${m("H = \\dfrac{u^2\\sin^2\\theta}{2g}")} = ${f(H)} m.`), H, [(u * u * s) / (2 * G), (u * u * s * s) / G, (u * u) / (2 * G) === H ? H * 2 : (u * u) / (2 * G)], "m");
  },
  (r) => {
    const h = r.pick([20, 45, 80, 125, 180]), u = r.int(4, 20);
    const t = Math.sqrt((2 * h) / G), R = u * t;
    return num(r, B("Kinematics", "Horizontal projection", "Medium", `A ball is thrown horizontally with speed ${m(`${u}\\,\\text{m/s}`)} from the top of a building ${h} m high. How far from the foot of the building does it land? (${m("g = 10\\,\\text{m/s}^2")})`, `Time of fall ${m(`t = \\sqrt{2h/g} = ${f(t)}`)} s; range ${m(`= ut = ${u}\\times${f(t)} = ${f(R)}`)} m.`), R, [u * Math.sqrt(h / G), (u * 2 * h) / G, u * h / G], "m");
  },
  (r) => {
    const l1 = r.pick([100, 120, 150, 200, 250]), l2 = r.pick([100, 150, 200, 300]), v1 = r.pick([10, 15, 20, 25]), v2 = r.pick([5, 10, 15, 20]);
    const t = (l1 + l2) / (v1 + v2);
    return num(r, B("Kinematics", "Relative velocity", "Medium", `Two trains of lengths ${l1} m and ${l2} m move on parallel tracks in opposite directions with speeds ${v1} m/s and ${v2} m/s. The time taken to cross each other is`, `Relative speed ${m(`= ${v1}+${v2} = ${v1 + v2}`)} m/s; distance ${m(`= ${l1}+${l2}`)} m; ${m(`t = ${l1 + l2}/${v1 + v2} = ${f(t)}`)} s.`), t, [(l1 + l2) / Math.abs(v1 - v2 || 1), l1 / (v1 + v2), (l1 + l2) / v1], "s");
  },
  // ---------------------------------------------------------------- Laws of motion
  (r) => {
    const mass = r.int(2, 20), F = r.int(10, 100), mu = r.pick([0, 0.1, 0.2, 0.25]);
    const fr = mu * mass * G;
    if (F <= fr) return null;
    const a = (F - fr) / mass;
    return num(r, B("Laws of Motion", "Friction", mu ? "Medium" : "Easy", `A horizontal force of ${F} N acts on a block of mass ${mass} kg resting on a horizontal surface${mu ? ` with coefficient of kinetic friction ${mu}` : " (frictionless)"}. The acceleration of the block is (${m("g = 10\\,\\text{m/s}^2")})`, `${m(`a = \\dfrac{F - \\mu mg}{m} = \\dfrac{${F} - ${f(fr)}}{${mass}} = ${f(a)}`)} m/s².`), a, [F / mass, (F + fr) / mass, (F - mu * mass) / mass], "m/s²");
  },
  (r) => {
    const m1 = r.int(2, 10), m2 = r.int(1, m1 - 1);
    const a = ((m1 - m2) * G) / (m1 + m2);
    return num(r, B("Laws of Motion", "Atwood machine", "Medium", `Two masses ${m1} kg and ${m2} kg are connected by a light string over a frictionless pulley. The acceleration of the system is (${m("g = 10\\,\\text{m/s}^2")})`, `${m(`a = \\dfrac{(m_1 - m_2)g}{m_1+m_2} = \\dfrac{${m1 - m2}\\times10}{${m1 + m2}} = ${f(a)}`)} m/s².`), a, [((m1 + m2) * G) / (m1 - m2), ((m1 - m2) * G) / m1, (m1 * G) / (m1 + m2)], "m/s²");
  },
  (r) => {
    const m1 = r.int(2, 10), m2 = r.int(1, m1 - 1);
    const T = (2 * m1 * m2 * G) / (m1 + m2);
    return num(r, B("Laws of Motion", "Atwood machine", "Medium", `In an Atwood machine, masses of ${m1} kg and ${m2} kg hang from the two ends of a light string passing over a frictionless pulley. The tension in the string is (${m("g = 10\\,\\text{m/s}^2")})`, `${m(`T = \\dfrac{2m_1m_2 g}{m_1+m_2} = \\dfrac{2\\times${m1}\\times${m2}\\times10}{${m1 + m2}} = ${f(T)}`)} N.`), T, [(m1 * m2 * G) / (m1 + m2), m1 * G, ((m1 - m2) * G * m2) / (m1 + m2)], "N");
  },
  (r) => {
    const th = r.pick([30, 37, 45, 53, 60]);
    const sinv: Record<number, number> = { 30: 0.5, 37: 0.6, 45: Math.SQRT1_2, 53: 0.8, 60: Math.sqrt(3) / 2 };
    const a = G * sinv[th];
    return num(r, B("Laws of Motion", "Inclined plane", "Easy", `A block slides down a smooth inclined plane of inclination ${th}°${th === 37 || th === 53 ? ` (take ${m(`\\sin ${th}^\\circ = ${th === 37 ? 0.6 : 0.8}`)})` : ""}. Its acceleration is (${m("g = 10\\,\\text{m/s}^2")})`, `On a smooth incline ${m("a = g\\sin\\theta")} = ${f(a)} m/s².`), a, [G * Math.cos((th * Math.PI) / 180), G, G * Math.tan((th * Math.PI) / 180)], "m/s²");
  },
  (r) => {
    const mass = r.pick([0.1, 0.2, 0.25, 0.5, 1, 2]), v = r.int(5, 30), e = r.pick(["rebounds with the same speed", "comes to rest"]);
    const J = e.startsWith("re") ? 2 * mass * v : mass * v;
    return num(r, B("Laws of Motion", "Impulse", "Easy", `A ball of mass ${mass} kg hits a wall normally with speed ${v} m/s and ${e}. The magnitude of impulse imparted by the wall is`, `Impulse = change in momentum = ${e.startsWith("re") ? m(`2mv = 2\\times${mass}\\times${v}`) : m(`mv = ${mass}\\times${v}`)} = ${f(J)} N s.`), J, [e.startsWith("re") ? mass * v : 2 * mass * v, 0, mass * v * v], "N s");
  },
  // ---------------------------------------------------------------- Work, energy, power
  (r) => {
    const mass = r.int(1, 20), v = r.int(2, 20);
    const K = 0.5 * mass * v * v;
    return num(r, B("Work, Energy and Power", "Kinetic energy", "Easy", `The kinetic energy of a body of mass ${mass} kg moving with speed ${v} m/s is`, `${m(`K = \\tfrac12 mv^2 = \\tfrac12(${mass})(${v})^2 = ${f(K)}`)} J.`), K, [mass * v * v, 0.5 * mass * v, mass * v], "J");
  },
  (r) => {
    const F = r.int(5, 50), d = r.int(2, 20), th = r.pick([0, 30, 60, 90]);
    const W = F * d * Math.cos((th * Math.PI) / 180);
    return num(r, B("Work, Energy and Power", "Work done", "Easy", `A force of ${F} N displaces a body by ${d} m. If the force makes an angle of ${th}° with the displacement, the work done is`, `${m(`W = Fd\\cos\\theta = ${F}\\times${d}\\times\\cos${th}^\\circ = ${f(W)}`)} J.`), W, [F * d, F * d * Math.sin((th * Math.PI) / 180), F / d], "J");
  },
  (r) => {
    const mass = r.int(10, 100), h = r.int(5, 30), t = r.int(5, 30);
    const P = (mass * G * h) / t;
    return num(r, B("Work, Energy and Power", "Power", "Medium", `A motor lifts a load of ${mass} kg through a height of ${h} m in ${t} s at constant speed. The power delivered is (${m("g = 10\\,\\text{m/s}^2")})`, `${m(`P = \\dfrac{mgh}{t} = \\dfrac{${mass}\\times10\\times${h}}{${t}} = ${f(P)}`)} W.`), P, [mass * G * h, (mass * h) / t, (mass * G * t) / h], "W");
  },
  (r) => {
    const k = r.pick([100, 200, 400, 500, 800, 1000]), x = r.pick([0.02, 0.05, 0.1, 0.2]);
    const U = 0.5 * k * x * x;
    return num(r, B("Work, Energy and Power", "Spring potential energy", "Easy", `A spring of force constant ${k} N/m is compressed by ${x * 100} cm. The elastic potential energy stored is`, `${m(`U = \\tfrac12 kx^2 = \\tfrac12(${k})(${x})^2 = ${f(U)}`)} J.`), U, [k * x * x, 0.5 * k * x, 0.5 * k * (x * 100) ** 2 / 1000], "J");
  },
  (r) => {
    const h = r.pick([5, 20, 45, 80, 125, 1.25, 3.2, 7.2]);
    const v = Math.sqrt(2 * G * h);
    return num(r, B("Work, Energy and Power", "Conservation of energy", "Easy", `A bob is released from rest and slides down a frictionless curved track from a height of ${h} m. Its speed at the bottom is (${m("g = 10\\,\\text{m/s}^2")})`, `${m("mgh = \\tfrac12 mv^2 \\Rightarrow v = \\sqrt{2gh}")} = ${f(v)} m/s.`), v, [Math.sqrt(G * h), 2 * G * h, Math.sqrt(2 * h)], "m/s");
  },
  // ---------------------------------------------------------------- Rotation
  (r) => {
    const bodies = [
      { n: "a thin ring about its central axis", k: 1, s: "MR^2" },
      { n: "a uniform disc about its central axis", k: 0.5, s: "\\tfrac12 MR^2" },
      { n: "a solid sphere about a diameter", k: 0.4, s: "\\tfrac25 MR^2" },
      { n: "a thin spherical shell about a diameter", k: 2 / 3, s: "\\tfrac23 MR^2" },
    ];
    const b = r.pick(bodies), M = r.int(1, 10), R = r.pick([0.1, 0.2, 0.3, 0.5, 1]);
    const I = b.k * M * R * R;
    return num(r, B("Rotational Motion", "Moment of inertia", "Easy", `The moment of inertia of ${b.n}, of mass ${M} kg and radius ${R} m, is`, `${m(`I = ${b.s} = ${f(I)}`)} kg m².`), I, bodies.filter((x) => x !== b).map((x) => x.k * M * R * R), "kg m²");
  },
  (r) => {
    const bodies = [
      { n: "ring", k: 1 },
      { n: "solid cylinder", k: 0.5 },
      { n: "solid sphere", k: 0.4 },
      { n: "hollow sphere", k: 2 / 3 },
    ];
    const b = r.pick(bodies), th = r.pick([30, 37, 53]);
    const s = th === 30 ? 0.5 : th === 37 ? 0.6 : 0.8;
    const a = (G * s) / (1 + b.k);
    return num(r, B("Rotational Motion", "Rolling motion", "Medium", `A ${b.n} rolls without slipping down an incline of angle ${th}°${th !== 30 ? ` (take ${m(`\\sin${th}^\\circ = ${s}`)})` : ""}. Its acceleration is (${m("g = 10\\,\\text{m/s}^2")})`, `${m("a = \\dfrac{g\\sin\\theta}{1 + I/(MR^2)}")} with ${m(`I/MR^2 = ${f(b.k)}`)}: ${m(`a = ${f(a)}`)} m/s².`), a, [G * s, ...bodies.filter((x) => x !== b).map((x) => (G * s) / (1 + x.k))], "m/s²");
  },
  (r) => {
    const I1 = r.int(2, 10), w1 = r.int(2, 12), factor = r.pick([2, 3, 4, 0.5]);
    const I2 = I1 / factor, w2 = w1 * factor;
    return num(r, B("Rotational Motion", "Angular momentum", "Medium", `A skater spins with angular speed ${w1} rad/s with moment of inertia ${I1} kg m². On folding the arms, the moment of inertia becomes ${f(I2)} kg m². The new angular speed is`, `Angular momentum is conserved: ${m(`\\omega_2 = \\dfrac{I_1\\omega_1}{I_2} = \\dfrac{${I1}\\times${w1}}{${f(I2)}} = ${f(w2)}`)} rad/s.`), w2, [w1 / factor, w1, w1 * factor * factor], "rad/s");
  },
  // ---------------------------------------------------------------- Gravitation
  (r) => {
    const n = r.pick([1, 2, 3, 4]);
    const g = 1 / ((1 + n) * (1 + n));
    return num(r, B("Gravitation", "Variation of g", "Medium", `At what fraction of its surface value is the acceleration due to gravity at a height ${n === 1 ? "R" : `${n}R`} above the Earth's surface (R = radius of Earth)?`, `${m("g_h = g\\left(\\dfrac{R}{R+h}\\right)^2")} = ${m(`g/${(1 + n) ** 2}`)}.`), g, [1 / (1 + n), 1 / (n * n || 1), 1 / (2 * (1 + n))], "", ratio);
  },
  (r) => {
    const R = r.pick([2, 3, 4, 0.5]), rho = r.pick([1, 4, 0.25]);
    const ve = R * Math.sqrt(rho);
    return num(r, B("Gravitation", "Escape velocity", "Medium", `A planet has radius ${f(R)} times and mean density ${f(rho)} times that of the Earth. Its escape velocity is how many times that of the Earth?`, `${m("v_e = \\sqrt{2GM/R} \\propto R\\sqrt{\\rho}")} ⇒ ratio ${m(`= ${f(R)}\\sqrt{${f(rho)}} = ${f(ve)}`)}.`), ve, [Math.sqrt(R * rho), R * rho, Math.sqrt(R) * rho]);
  },
  (r) => {
    const k = r.pick([4, 9, 16, 1 / 4]), T1 = r.pick([1, 2, 3, 5]);
    const T2 = T1 * Math.pow(k, 1.5);
    return num(r, B("Gravitation", "Kepler's laws", "Medium", `A satellite revolves around a planet with period ${T1} day(s). Another satellite orbits at ${k < 1 ? m(frac(1, 1 / k)) : k} times the orbital radius. Its period is`, `${m("T^2 \\propto r^3 \\Rightarrow T_2 = T_1 k^{3/2}")} = ${f(T2)} days.`), T2, [T1 * k, T1 * k * k, T1 * Math.sqrt(k)], "days");
  },
  // ---------------------------------------------------------------- Properties of matter
  (r) => {
    const Fn = r.pick([100, 200, 500, 1000]), L = r.pick([1, 2, 3]), A = r.pick([1e-6, 2e-6, 5e-6]), Y = r.pick([1e11, 2e11]);
    const dL = (Fn * L) / (A * Y);
    return num(r, B("Mechanical Properties of Solids", "Young's modulus", "Medium", `A wire of length ${L} m and cross-sectional area ${m(sci(A))} m² is stretched by a force of ${Fn} N. If Young's modulus is ${m(sci(Y))} N/m², the extension is`, `${m("\\Delta L = \\dfrac{FL}{AY}")} = ${m(sci(dL))} m.`), dL, [Fn / (A * Y), (Fn * L * A) / Y, (2 * Fn * L) / (A * Y)], "m", (x) => m(sci(x)));
  },
  (r) => {
    const h = r.int(2, 50), liquid = r.pick([{ n: "water", d: 1000 }, { n: "a liquid of density 800 kg/m³", d: 800 }, { n: "sea water of density 1030 kg/m³", d: 1030 }]);
    const P = liquid.d * G * h;
    return num(r, B("Mechanical Properties of Fluids", "Pressure", "Easy", `The gauge pressure at a depth of ${h} m in ${liquid.n} is (${m("g = 10\\,\\text{m/s}^2")}${liquid.n === "water" ? ", density 1000 kg/m³" : ""})`, `${m(`P = \\rho g h = ${liquid.d}\\times10\\times${h}`)} = ${m(sci(P))} Pa.`), P, [liquid.d * h, P + 1e5, (liquid.d * G) / h], "Pa", (x) => m(sci(x)));
  },
  // ---------------------------------------------------------------- Thermal physics
  (r) => {
    const mass = r.pick([0.2, 0.5, 1, 2, 5]), dT = r.int(5, 60), mat = r.pick([{ n: "water", c: 4200 }, { n: "aluminium", c: 900 }, { n: "copper", c: 390 }, { n: "iron", c: 450 }]);
    const Q = mass * mat.c * dT;
    return num(r, B("Thermal Properties of Matter", "Specific heat", "Easy", `Heat required to raise the temperature of ${mass} kg of ${mat.n} (specific heat ${mat.c} J kg⁻¹ K⁻¹) by ${dT} °C is`, `${m(`Q = mc\\Delta T = ${mass}\\times${mat.c}\\times${dT} = ${f(Q)}`)} J.`), Q, [mat.c * dT, mass * mat.c, (mass * mat.c * dT) / 2], "J");
  },
  (r) => {
    const n = r.pick([1, 2, 0.5]), T = r.pick([300, 400, 600]), V = r.pick([0.01, 0.02, 0.025, 0.05]);
    const R = 8.3, P = (n * R * T) / V;
    return num(r, B("Kinetic Theory", "Ideal gas equation", "Easy", `${n} mole of an ideal gas occupies ${V * 1000} L at ${T} K. Its pressure is (R = 8.3 J mol⁻¹ K⁻¹)`, `${m(`P = \\dfrac{nRT}{V} = \\dfrac{${n}\\times8.3\\times${T}}{${V}}`)} = ${m(sci(P))} Pa.`), P, [(n * R * T) / (V * 1000), (n * T) / V, (n * R * V) / T], "Pa", (x) => m(sci(x)));
  },
  (r) => {
    const T1 = r.pick([400, 500, 600, 800, 1000]), T2 = r.pick([200, 250, 300, 400]);
    if (T2 >= T1) return null;
    const eta = (1 - T2 / T1) * 100;
    return num(r, B("Thermodynamics", "Carnot engine", "Easy", `A Carnot engine works between ${T1} K and ${T2} K. Its efficiency is`, `${m(`\\eta = 1 - \\dfrac{T_2}{T_1} = 1 - \\dfrac{${T2}}{${T1}}`)} = ${f(eta)}%.`), eta, [(T2 / T1) * 100, (1 - T1 / (T1 + T2)) * 100, ((T1 - T2) / T2) * 100], "%");
  },
  (r) => {
    const k = r.pick([4, 9, 16, 1 / 4]);
    const rt = Math.sqrt(k);
    return num(r, B("Kinetic Theory", "RMS speed", "Easy", `If the absolute temperature of a gas is increased ${k < 1 ? "to one-fourth" : `${k} times`}, its rms speed becomes`, `${m("v_{rms} \\propto \\sqrt{T}")} ⇒ factor ${m(`\\sqrt{${k < 1 ? "1/4" : k}} = ${f(rt)}`)}.`), rt, [k, k * k, 1 / rt], "times");
  },
  (r) => {
    const Q = r.int(100, 1000), W = r.int(20, 90);
    if (W >= Q) return null;
    const dU = Q - W;
    return num(r, B("Thermodynamics", "First law", "Easy", `A gas absorbs ${Q} J of heat and does ${W} J of work on the surroundings. The change in its internal energy is`, `${m(`\\Delta U = Q - W = ${Q} - ${W} = ${dU}`)} J.`), dU, [Q + W, W - Q, Q], "J");
  },
  // ---------------------------------------------------------------- Oscillations & waves
  (r) => {
    const mass = r.pick([0.1, 0.25, 0.5, 1, 2, 4]), k = r.pick([10, 25, 40, 100, 400]);
    const coeff = 2 * Math.sqrt(mass / k);
    return num(r, B("Oscillations", "Spring-mass system", "Medium", `A mass of ${mass} kg attached to a spring of force constant ${k} N/m oscillates on a smooth surface. Its time period is`, `${m(`T = 2\\pi\\sqrt{m/k} = 2\\pi\\sqrt{${mass}/${k}} = ${f(coeff)}\\pi`)} s.`), coeff, [2 * Math.sqrt(k / mass), Math.sqrt(mass / k), coeff * 2], "", (x) => `${m(`${f(x)}\\pi`)} s`);
  },
  (r) => {
    const k = r.pick([4, 9, 16, 1 / 4, 1 / 9]);
    const rt = Math.sqrt(k);
    return num(r, B("Oscillations", "Simple pendulum", "Easy", `The length of a simple pendulum is made ${k < 1 ? `${m(frac(1, Math.round(1 / k)))} of its original value` : `${k} times`}. Its time period becomes`, `${m("T \\propto \\sqrt{l}")} ⇒ factor ${f(rt)}.`), rt, [k, 1 / rt, k * k], "times");
  },
  (r) => {
    const fq = r.pick([170, 256, 340, 512, 680]), v = r.pick([330, 340]);
    const lam = v / fq;
    return num(r, B("Waves", "Wave speed", "Easy", `A sound wave of frequency ${fq} Hz travels in air with speed ${v} m/s. Its wavelength is`, `${m(`\\lambda = v/f = ${v}/${fq} = ${f(lam)}`)} m.`), lam, [fq / v, v * fq, lam * 2], "m");
  },
  (r) => {
    const f1 = r.int(250, 520), d = r.int(2, 9), loaded = r.next() < 0.5;
    const f2 = f1 + d;
    return num(r, B("Waves", "Beats", "Easy", `Two tuning forks of frequencies ${f1} Hz and ${f2} Hz are sounded together. The number of beats heard per second is`, `Beat frequency ${m(`= |f_1 - f_2| = ${d}`)} Hz.`), d, [f1 + f2, (f1 + f2) / 2, d * 2], loaded ? "beats/s" : "Hz");
  },
  (r) => {
    const L = r.pick([0.5, 1, 1.5, 2]), T = r.pick([100, 200, 400, 900]), mu = r.pick([0.01, 0.04, 0.001]);
    const v = Math.sqrt(T / mu), f0 = v / (2 * L);
    return num(r, B("Waves", "Stationary waves on strings", "Medium", `A string of length ${L} m and linear mass density ${mu} kg/m is stretched with tension ${T} N. The fundamental frequency of vibration is`, `${m(`v = \\sqrt{T/\\mu} = ${f(v)}`)} m/s; ${m(`f = v/2L = ${f(f0)}`)} Hz.`), f0, [v / L, v / (4 * L), Math.sqrt(T * mu) / (2 * L)], "Hz");
  },
  (r) => {
    const fs = r.pick([500, 600, 680, 720, 800]), vs = r.pick([10, 20, 30, 40]), v = 340;
    const fo = (fs * v) / (v - vs);
    return num(r, B("Waves", "Doppler effect", "Medium", `A source of sound of frequency ${fs} Hz moves towards a stationary observer at ${vs} m/s. The apparent frequency heard is (speed of sound 340 m/s)`, `${m(`f' = f\\dfrac{v}{v - v_s} = ${fs}\\times\\dfrac{340}{${340 - vs}}`)} = ${f(fo)} Hz.`), fo, [(fs * v) / (v + vs), (fs * (v + vs)) / v, fs], "Hz");
  },
  // ---------------------------------------------------------------- Electrostatics
  (r) => {
    const q1 = r.int(1, 10), q2 = r.int(1, 10), d = r.pick([0.1, 0.2, 0.3, 0.5, 1]);
    const F = (9e9 * q1 * 1e-6 * q2 * 1e-6) / (d * d);
    return num(r, B("Electric Charges and Fields", "Coulomb's law", "Easy", `Two point charges of ${q1} μC and ${q2} μC are separated by ${d * 100} cm in vacuum. The electrostatic force between them is (${m("k = 9\\times10^9")} N m² C⁻²)`, `${m(`F = \\dfrac{kq_1q_2}{r^2} = \\dfrac{9\\times10^9\\times${q1}\\times10^{-6}\\times${q2}\\times10^{-6}}{(${d})^2}`)} = ${f(F)} N.`), F, [F * d, (9e9 * q1 * q2 * 1e-12) / d, F * 100], "N");
  },
  (r) => {
    const c = r.sample([1, 2, 3, 4, 6, 12], r.int(2, 3)), series = r.next() < 0.5;
    const Ceq = series ? 1 / c.reduce((a, x) => a + 1 / x, 0) : c.reduce((a, x) => a + x, 0);
    return num(r, B("Electrostatic Potential and Capacitance", "Combination of capacitors", "Easy", `Capacitors of ${c.join(" μF, ")} μF are connected in ${series ? "series" : "parallel"}. The equivalent capacitance is`, series ? `${m("\\tfrac{1}{C} = \\sum\\tfrac{1}{C_i}")} ⇒ ${m(`C = ${f(Ceq)}`)} μF.` : `${m("C = \\sum C_i")} = ${f(Ceq)} μF.`), Ceq, [series ? c.reduce((a, x) => a + x, 0) : 1 / c.reduce((a, x) => a + 1 / x, 0), Ceq * 2, c.reduce((a, x) => a * x, 1) / c.length], "μF");
  },
  (r) => {
    const C = r.pick([2, 4, 5, 10, 20]), V = r.pick([10, 50, 100, 200]);
    const U = 0.5 * C * 1e-6 * V * V;
    return num(r, B("Electrostatic Potential and Capacitance", "Energy stored", "Easy", `A ${C} μF capacitor is charged to ${V} V. The energy stored in it is`, `${m(`U = \\tfrac12 CV^2 = \\tfrac12\\times${C}\\times10^{-6}\\times${V}^2`)} = ${f(U)} J.`), U, [C * 1e-6 * V * V, 0.5 * C * 1e-6 * V, U * 1e3], "J");
  },
  (r) => {
    const q = r.int(1, 9), d = r.pick([0.1, 0.3, 0.5, 1, 3]);
    const E = (9e9 * q * 1e-9) / (d * d);
    return num(r, B("Electric Charges and Fields", "Electric field", "Easy", `The electric field at a distance of ${d} m from a point charge of ${q} nC is (${m("k = 9\\times10^9")} N m² C⁻²)`, `${m(`E = \\dfrac{kq}{r^2} = \\dfrac{9\\times10^9\\times${q}\\times10^{-9}}{${d}^2}`)} = ${f(E)} N/C.`), E, [E * d, (9e9 * q * 1e-9) / d, E / 10], "N/C");
  },
  // ---------------------------------------------------------------- Current electricity
  (r) => {
    const R = r.sample([2, 3, 4, 6, 8, 12], r.int(2, 3)), series = r.next() < 0.5;
    const Req = series ? R.reduce((a, x) => a + x, 0) : 1 / R.reduce((a, x) => a + 1 / x, 0);
    return num(r, B("Current Electricity", "Combination of resistors", "Easy", `Resistors of ${R.join(" Ω, ")} Ω are connected in ${series ? "series" : "parallel"}. The equivalent resistance is`, series ? `${m("R = \\sum R_i")} = ${f(Req)} Ω.` : `${m("\\tfrac1R = \\sum\\tfrac{1}{R_i}")} ⇒ ${m(`R = ${f(Req)}`)} Ω.`), Req, [series ? 1 / R.reduce((a, x) => a + 1 / x, 0) : R.reduce((a, x) => a + x, 0), Req * 2, Req / 2], "Ω");
  },
  (r) => {
    const E = r.pick([1.5, 2, 3, 6, 9, 12]), rr = r.pick([0.5, 1, 2]), R = r.int(1, 10);
    const I = E / (R + rr);
    return num(r, B("Current Electricity", "EMF and internal resistance", "Medium", `A cell of emf ${E} V and internal resistance ${rr} Ω is connected to an external resistance of ${R} Ω. The current in the circuit is`, `${m(`I = \\dfrac{E}{R + r} = \\dfrac{${E}}{${R + rr}}`)} = ${f(I)} A.`), I, [E / R, E / rr, (E * R) / (R + rr)], "A");
  },
  (r) => {
    const V = r.pick([110, 220, 230]), P = r.pick([40, 60, 100, 200, 500, 1000]);
    const R = (V * V) / P;
    return num(r, B("Current Electricity", "Electric power", "Easy", `An electric appliance is rated ${P} W, ${V} V. Its resistance is`, `${m(`R = V^2/P = ${V}^2/${P}`)} = ${f(R)} Ω.`), R, [V / P, P / V, (V * V) / (2 * P)], "Ω");
  },
  (r) => {
    const P = r.pick([2, 4, 5, 10]), Q = r.pick([4, 5, 8, 20]), S = r.pick([3, 6, 12, 15]);
    const X = (Q * S) / P;
    return num(r, B("Current Electricity", "Wheatstone bridge", "Medium", `In a balanced Wheatstone bridge, P = ${P} Ω, Q = ${Q} Ω and S = ${S} Ω (with P/Q = R/S). The unknown resistance R is`, `${m(`R = \\dfrac{P S}{Q} = \\dfrac{${P}\\times${S}}{${Q}}`)} = ${f((P * S) / Q)} Ω.`), (P * S) / Q, [X, (P * Q) / S, P + S + Q], "Ω");
  },
  // ---------------------------------------------------------------- Magnetism
  (r) => {
    const Bf = r.pick([0.1, 0.2, 0.5, 1, 2]), I = r.int(1, 10), L = r.pick([0.1, 0.2, 0.5, 1]), th = r.pick([30, 90]);
    const F = Bf * I * L * Math.sin((th * Math.PI) / 180);
    return num(r, B("Moving Charges and Magnetism", "Force on a conductor", "Easy", `A straight wire of length ${L} m carrying ${I} A is placed in a uniform magnetic field of ${Bf} T at ${th}° to the field. The force on it is`, `${m(`F = BIL\\sin\\theta = ${Bf}\\times${I}\\times${L}\\times\\sin${th}^\\circ`)} = ${f(F)} N.`), F, [Bf * I * L * Math.cos((th * Math.PI) / 180) || Bf * I, Bf * I * L * 2, (Bf * I) / L], "N");
  },
  (r) => {
    const I = r.int(1, 20), d = r.pick([0.02, 0.05, 0.1, 0.2]);
    const Bv = (2e-7 * I) / d;
    return num(r, B("Moving Charges and Magnetism", "Field of a straight wire", "Easy", `The magnetic field at a distance of ${d * 100} cm from a long straight wire carrying ${I} A is (${m("\\mu_0 = 4\\pi\\times10^{-7}")} T m/A)`, `${m(`B = \\dfrac{\\mu_0 I}{2\\pi r} = \\dfrac{2\\times10^{-7}\\times${I}}{${d}}`)} = ${m(sci(Bv))} T.`), Bv, [(4e-7 * I) / d, (2e-7 * I) / (d * d), 2e-7 * I * d], "T", (x) => m(sci(x)));
  },
  (r) => {
    const k = r.pick([2, 3, 4]), what = r.pick(["speed", "magnetic field"]);
    const rr = what === "speed" ? k : 1 / k;
    return num(r, B("Moving Charges and Magnetism", "Motion in a magnetic field", "Medium", `A charged particle moves in a circle in a uniform magnetic field. If the ${what} is made ${k} times (other quantities unchanged), the radius of the path becomes`, `${m("r = \\dfrac{mv}{qB}")} ⇒ radius ${what === "speed" ? "∝ v" : "∝ 1/B"} ⇒ factor ${f(rr)}.`), rr, [what === "speed" ? 1 / k : k, k * k, 1], "times", (x) => ratio(x));
  },
  // ---------------------------------------------------------------- EMI & AC
  (r) => {
    const Bf = r.pick([0.1, 0.2, 0.5, 1]), l = r.pick([0.1, 0.2, 0.5, 1]), v = r.int(2, 20);
    const e = Bf * l * v;
    return num(r, B("Electromagnetic Induction", "Motional emf", "Easy", `A rod of length ${l} m moves at ${v} m/s perpendicular to a uniform magnetic field of ${Bf} T. The emf induced across its ends is`, `${m(`\\varepsilon = Blv = ${Bf}\\times${l}\\times${v}`)} = ${f(e)} V.`), e, [Bf * v, (Bf * l) / v, 0.5 * Bf * l * v], "V");
  },
  (r) => {
    const N = r.pick([50, 100, 200, 500]), dphi = r.pick([0.01, 0.02, 0.05]), dt = r.pick([0.1, 0.2, 0.5]);
    const e = (N * dphi) / dt;
    return num(r, B("Electromagnetic Induction", "Faraday's law", "Easy", `The magnetic flux through each turn of a ${N}-turn coil changes by ${dphi} Wb in ${dt} s. The average induced emf is`, `${m(`\\varepsilon = N\\dfrac{\\Delta\\phi}{\\Delta t} = \\dfrac{${N}\\times${dphi}}{${dt}}`)} = ${f(e)} V.`), e, [dphi / dt, N * dphi * dt, e / N], "V");
  },
  (r) => {
    const Np = r.pick([100, 200, 500, 1000]), Ns = r.pick([50, 1000, 2000, 25, 4000]), Vp = r.pick([220, 110, 240]);
    if (Np === Ns) return null;
    const Vs = (Vp * Ns) / Np;
    return num(r, B("Alternating Current", "Transformer", "Easy", `An ideal transformer has ${Np} turns in the primary and ${Ns} turns in the secondary. If the primary voltage is ${Vp} V, the secondary voltage is`, `${m(`V_s = V_p\\dfrac{N_s}{N_p} = ${Vp}\\times\\dfrac{${Ns}}{${Np}}`)} = ${f(Vs)} V.`), Vs, [(Vp * Np) / Ns, Vp, Vs * 2], "V");
  },
  (r) => {
    const V0 = r.pick([100, 141.4, 200, 311, 220]), which = r.pick(["rms", "peak"]);
    const ans = which === "rms" ? V0 / Math.SQRT2 : V0;
    const given = which === "rms" ? V0 : V0 / Math.SQRT2;
    return num(r, B("Alternating Current", "RMS value", "Easy", which === "rms" ? `The peak value of an alternating voltage is ${V0} V. Its rms value is` : `The rms value of an alternating voltage is ${f(given)} V. Its peak value is`, which === "rms" ? `${m("V_{rms} = V_0/\\sqrt2")} = ${f(ans)} V.` : `${m("V_0 = \\sqrt2 V_{rms}")} = ${f(ans)} V.`), ans, [which === "rms" ? V0 * Math.SQRT2 : given / Math.SQRT2, which === "rms" ? V0 / 2 : given * 2, given], "V");
  },
  (r) => {
    const L = r.pick([0.1, 0.2, 0.5, 1]), fq = r.pick([50, 60, 100]);
    const X = 2 * L * fq; // coefficient of π
    return num(r, B("Alternating Current", "Inductive reactance", "Easy", `The reactance of a ${L} H inductor at ${fq} Hz is`, `${m(`X_L = 2\\pi f L = 2\\pi\\times${fq}\\times${L} = ${f(X)}\\pi`)} Ω.`), X, [L * fq, X * 2, 1 / X], "", (x) => `${m(`${f(x)}\\pi`)} Ω`);
  },
  // ---------------------------------------------------------------- Optics
  (r) => {
    const fl = r.pick([10, 15, 20, 30]), u = r.pick([15, 20, 25, 30, 40, 45, 60]);
    if (u === fl) return null;
    const v = (fl * u) / (u - fl); // concave mirror, real object (sign convention: magnitudes, real image if u>f)
    if (!Number.isFinite(v)) return null;
    return num(r, B("Ray Optics", "Mirror formula", "Medium", `An object is placed ${u} cm in front of a concave mirror of focal length ${fl} cm. The distance of the image from the mirror is`, `${m("\\tfrac1v + \\tfrac1u = \\tfrac1f")} with ${m(`u = -${u}`)}, ${m(`f = -${fl}`)} ⇒ ${m(`|v| = ${f(Math.abs(v))}`)} cm${v < 0 ? " (virtual, behind the mirror)" : " (real, in front)"}.`), Math.abs(v), [(fl * u) / (u + fl), u - fl, u + fl], "cm");
  },
  (r) => {
    const fl = r.pick([10, 12, 15, 20, 25]), u = r.pick([20, 24, 30, 40, 50, 60, 75]);
    if (u <= fl) return null;
    const v = (fl * u) / (u - fl);
    return num(r, B("Ray Optics", "Lens formula", "Medium", `An object is placed ${u} cm from a convex lens of focal length ${fl} cm. The image distance is`, `${m("\\tfrac1v - \\tfrac1u = \\tfrac1f")} with ${m(`u = -${u}`)} ⇒ ${m(`v = ${f(v)}`)} cm.`), v, [(fl * u) / (u + fl), u - fl, (u * u) / fl], "cm");
  },
  (r) => {
    const fcm = r.pick([10, 20, 25, 40, 50, -20, -25, -50, -100]);
    const P = 100 / fcm;
    return num(r, B("Ray Optics", "Power of a lens", "Easy", `The power of a ${fcm > 0 ? "convex" : "concave"} lens of focal length ${Math.abs(fcm)} cm is`, `${m(`P = \\dfrac{1}{f(\\text{m})} = \\dfrac{100}{${fcm}}`)} = ${f(P)} D.`), P, [-P, 1 / fcm, fcm / 100], "D");
  },
  (r) => {
    const pairs = [
      { mu: "\\sqrt2", c: 45 },
      { mu: "2", c: 30 },
      { mu: "\\tfrac{2}{\\sqrt3}", c: 60 },
    ];
    const p = r.pick(pairs);
    return num(r, B("Ray Optics", "Total internal reflection", "Easy", `The critical angle for light going from a medium of refractive index ${m(p.mu)} to air is`, `${m("\\sin C = 1/\\mu")} ⇒ ${m(`C = ${p.c}^\\circ`)}.`), p.c, [90 - p.c === p.c ? 60 : 90 - p.c, 15, 75], "°");
  },
  (r) => {
    const lam = r.pick([400, 500, 600, 640, 700]), D = r.pick([1, 1.5, 2]), d = r.pick([0.1, 0.2, 0.5, 1]);
    const beta = ((lam * 1e-9 * D) / (d * 1e-3)) * 1e3; // mm
    return num(r, B("Wave Optics", "Young's double slit", "Medium", `In Young's double-slit experiment, slits ${d} mm apart are illuminated by light of wavelength ${lam} nm and the screen is ${D} m away. The fringe width is`, `${m(`\\beta = \\dfrac{\\lambda D}{d} = \\dfrac{${lam}\\times10^{-9}\\times${D}}{${d}\\times10^{-3}}`)} = ${f(beta)} mm.`), beta, [beta * 2, beta / 2, (lam * 1e-9 * d * 1e-3) / D], "mm");
  },
  // ---------------------------------------------------------------- Modern physics
  (r) => {
    const lam = r.pick([248, 310, 400, 413.3, 496, 620]);
    const E = 1240 / lam;
    return num(r, B("Dual Nature of Radiation and Matter", "Photon energy", "Easy", `The energy of a photon of wavelength ${lam} nm is (use ${m("hc = 1240")} eV nm)`, `${m(`E = \\dfrac{1240}{${lam}}`)} = ${f(E)} eV.`), E, [lam / 1240, E * 2, 1240 / (lam * 10)], "eV");
  },
  (r) => {
    const E = r.pick([3, 4, 5, 6, 6.2]), phi = r.pick([1.8, 2, 2.3, 2.5]);
    if (E <= phi) return null;
    const K = E - phi;
    return num(r, B("Dual Nature of Radiation and Matter", "Photoelectric effect", "Easy", `Light of photon energy ${E} eV falls on a metal of work function ${phi} eV. The maximum kinetic energy of the emitted photoelectrons is`, `${m(`K_{max} = h\\nu - \\phi = ${E} - ${phi}`)} = ${f(K)} eV.`), K, [E + phi, phi, E], "eV");
  },
  (r) => {
    const V = r.pick([100, 150, 400, 900, 2500, 10000]);
    const lam = 12.27 / Math.sqrt(V);
    return num(r, B("Dual Nature of Radiation and Matter", "de Broglie wavelength", "Medium", `An electron is accelerated from rest through a potential difference of ${V} V. Its de Broglie wavelength is (use ${m("\\lambda = 12.27/\\sqrt{V}")} Å)`, `${m(`\\lambda = 12.27/\\sqrt{${V}}`)} = ${f(lam)} Å.`), lam, [12.27 / V, 12.27 * Math.sqrt(V) / 100, lam * 2], "Å");
  },
  (r) => {
    const n = r.int(1, 5), T = r.pick([2, 5, 10, 20, 30]);
    const frac_ = 1 / 2 ** n;
    return num(r, B("Nuclei", "Radioactive decay", "Easy", `The half-life of a radioactive sample is ${T} days. The fraction of the sample remaining after ${n * T} days is`, `${n * T}/${T} = ${n} half-lives ⇒ ${m(`(1/2)^{${n}} = ${frac(1, 2 ** n)}`)}.`), frac_, [1 / (2 * n), 1 - frac_, 1 / 2 ** (n + 1)], "", ratio);
  },
  (r) => {
    const n1 = r.int(1, 3), n2 = n1 + r.int(1, 3);
    const E = 13.6 * (1 / (n1 * n1) - 1 / (n2 * n2));
    return num(r, B("Atoms", "Bohr model", "Medium", `The energy of the photon emitted when the electron in a hydrogen atom jumps from n = ${n2} to n = ${n1} is (use ${m("E_n = -13.6/n^2")} eV)`, `${m(`\\Delta E = 13.6\\left(\\tfrac{1}{${n1 * n1}} - \\tfrac{1}{${n2 * n2}}\\right)`)} = ${f(E)} eV.`), E, [13.6 / (n2 * n2), 13.6 / (n1 * n1), 13.6 * (1 / n1 - 1 / n2)], "eV");
  },
  // ---------------------------------------------------------------- Semiconductors & units (conceptual tables)
  (r) => {
    const gates: Record<string, (a: number, b: number) => number> = { AND: (a, b) => a & b, OR: (a, b) => a | b, NAND: (a, b) => 1 - (a & b), NOR: (a, b) => 1 - (a | b), XOR: (a, b) => a ^ b };
    const g = r.pick(Object.keys(gates)), a = r.int(0, 1), b = r.int(0, 1);
    const out = gates[g](a, b);
    const item: Item = { ...B("Semiconductor Electronics", "Logic gates", "Easy", `For a two-input ${g} gate with inputs A = ${a} and B = ${b}, the output Y is`, `${g} truth table: Y(${a}, ${b}) = ${out}.`), correct: String(out), wrong: [String(1 - out), "Cannot be determined", "Depends on the supply voltage"] };
    return item;
  },
  (r) => {
    const dims: [string, string][] = [
      ["force", "[MLT^{-2}]"],
      ["work", "[ML^2T^{-2}]"],
      ["power", "[ML^2T^{-3}]"],
      ["pressure", "[ML^{-1}T^{-2}]"],
      ["momentum", "[MLT^{-1}]"],
      ["Planck's constant", "[ML^2T^{-1}]"],
      ["impulse", "[MLT^{-1}]"],
      ["surface tension", "[MT^{-2}]"],
      ["gravitational constant G", "[M^{-1}L^3T^{-2}]"],
      ["coefficient of viscosity", "[ML^{-1}T^{-1}]"],
      ["angular momentum", "[ML^2T^{-1}]"],
      ["torque", "[ML^2T^{-2}]"],
      ["Young's modulus", "[ML^{-1}T^{-2}]"],
      ["frequency", "[T^{-1}]"],
    ];
    const [q, d] = r.pick(dims);
    return txt(r, B("Units and Measurements", "Dimensional analysis", "Easy", `The dimensional formula of ${q} is`, `From its defining relation, ${q} has dimensions ${m(d)}.`), m(d), dims.filter(([, x]) => x !== d).map(([, x]) => m(x)));
  },
];
