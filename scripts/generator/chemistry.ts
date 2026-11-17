import { f, m, num, ratio, sci, txt, type Template } from "./core";

const B = (topic: string, subtopic: string, difficulty: "Easy" | "Medium", q: string, sol: string) => ({ topic, subtopic, difficulty, q, sol });

const COMPOUNDS: { f: string; tex: string; M: number }[] = [
  { f: "H2O", tex: "H_2O", M: 18 },
  { f: "CO2", tex: "CO_2", M: 44 },
  { f: "NH3", tex: "NH_3", M: 17 },
  { f: "CH4", tex: "CH_4", M: 16 },
  { f: "NaCl", tex: "NaCl", M: 58.5 },
  { f: "NaOH", tex: "NaOH", M: 40 },
  { f: "H2SO4", tex: "H_2SO_4", M: 98 },
  { f: "HCl", tex: "HCl", M: 36.5 },
  { f: "CaCO3", tex: "CaCO_3", M: 100 },
  { f: "C6H12O6", tex: "C_6H_{12}O_6", M: 180 },
  { f: "O2", tex: "O_2", M: 32 },
  { f: "N2", tex: "N_2", M: 28 },
  { f: "SO2", tex: "SO_2", M: 64 },
  { f: "KOH", tex: "KOH", M: 56 },
  { f: "HNO3", tex: "HNO_3", M: 63 },
  { f: "C2H5OH", tex: "C_2H_5OH", M: 46 },
];

const ELEMENTS: { s: string; Z: number }[] = [
  { s: "N", Z: 7 }, { s: "O", Z: 8 }, { s: "F", Z: 9 }, { s: "Na", Z: 11 }, { s: "Mg", Z: 12 }, { s: "Al", Z: 13 }, { s: "Si", Z: 14 }, { s: "P", Z: 15 }, { s: "S", Z: 16 },
  { s: "Cl", Z: 17 }, { s: "K", Z: 19 }, { s: "Ca", Z: 20 }, { s: "Sc", Z: 21 }, { s: "Ti", Z: 22 }, { s: "V", Z: 23 }, { s: "Cr", Z: 24 }, { s: "Mn", Z: 25 }, { s: "Fe", Z: 26 },
  { s: "Co", Z: 27 }, { s: "Ni", Z: 28 }, { s: "Cu", Z: 29 }, { s: "Zn", Z: 30 },
];

/** Ground-state configuration (Aufbau with Cr and Cu exceptions) → unpaired electrons. */
function unpaired(Z: number): number {
  if (Z === 24) return 6; // [Ar] 3d5 4s1
  if (Z === 29) return 1; // [Ar] 3d10 4s1
  const order: [string, number][] = [["1s", 2], ["2s", 2], ["2p", 6], ["3s", 2], ["3p", 6], ["4s", 2], ["3d", 10], ["4p", 6]];
  let left = Z, last = 0, cap = 0;
  const filled: Record<string, number> = {};
  for (const [o, c] of order) {
    const e = Math.min(left, c);
    filled[o] = e;
    left -= e;
    if (e) { last = e; cap = c; }
    if (!left) break;
  }
  let u = 0;
  for (const [o, c] of order) {
    const e = filled[o] ?? 0;
    const orbitals = c / 2;
    u += e <= orbitals ? e : 2 * orbitals - e;
  }
  void last; void cap;
  return u;
}

export const chemistry: Template[] = [
  // ---------------------------------------------------------------- Mole concept
  (r) => {
    const c = r.pick(COMPOUNDS), n = r.pick([0.1, 0.2, 0.25, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5]);
    const mass = n * c.M;
    return num(r, B("Some Basic Concepts of Chemistry", "Mole concept", "Easy", `How many moles are present in ${f(mass)} g of ${m(c.tex)}? (Molar mass = ${c.M} g/mol)`, `${m(`n = \\dfrac{\\text{mass}}{M} = \\dfrac{${f(mass)}}{${c.M}}`)} = ${f(n)} mol.`), n, [mass * c.M, c.M / mass, n * 2], "mol");
  },
  (r) => {
    const c = r.pick(COMPOUNDS), n = r.pick([0.1, 0.5, 1, 2, 3, 0.25]);
    const N = n * 6.022e23;
    return num(r, B("Some Basic Concepts of Chemistry", "Avogadro number", "Easy", `The number of molecules in ${f(n * c.M)} g of ${m(c.tex)} (M = ${c.M} g/mol) is`, `Moles = ${f(n)}; molecules ${m(`= ${f(n)}\\times6.022\\times10^{23}`)} = ${m(sci(N, 4))}.`), N, [N * 2, N / 2, 6.022e23 * n * c.M], "", (x) => m(sci(x, 4)));
  },
  (r) => {
    const c = r.pick(COMPOUNDS), mass = r.pick([2, 4, 5, 10, 20, 40]), V = r.pick([100, 200, 250, 500, 1000]);
    const M = mass / c.M / (V / 1000);
    return num(r, B("Some Basic Concepts of Chemistry", "Molarity", "Easy", `${mass} g of ${m(c.tex)} (M = ${c.M} g/mol) is dissolved in water to make ${V} mL of solution. The molarity is`, `${m(`M = \\dfrac{${mass}/${c.M}}{${V}/1000}`)} = ${f(M)} M.`), M, [mass / c.M, mass / V, M * 10], "M");
  },
  (r) => {
    const M1 = r.pick([0.5, 1, 2, 5, 6, 10, 12]), V1 = r.pick([10, 20, 25, 50, 100]), V2 = r.pick([100, 200, 250, 500, 1000]);
    if (V2 <= V1) return null;
    const M2 = (M1 * V1) / V2;
    return num(r, B("Some Basic Concepts of Chemistry", "Dilution", "Easy", `${V1} mL of ${M1} M HCl is diluted to ${V2} mL. The molarity of the diluted solution is`, `${m(`M_1V_1 = M_2V_2 \\Rightarrow M_2 = \\dfrac{${M1}\\times${V1}}{${V2}}`)} = ${f(M2)} M.`), M2, [(M1 * V2) / V1, (M1 * V1) / (V2 - V1), M1], "M");
  },
  (r) => {
    const c = r.pick(COMPOUNDS.filter((x) => x.M <= 100)), nsol = r.pick([0.1, 0.2, 0.5, 1, 2]), kg = r.pick([0.1, 0.2, 0.25, 0.5, 1]);
    const molality = nsol / kg;
    return num(r, B("Solutions", "Molality", "Easy", `${f(nsol * c.M)} g of ${m(c.tex)} (M = ${c.M} g/mol) is dissolved in ${kg * 1000} g of water. The molality of the solution is`, `${m(`m = \\dfrac{\\text{moles of solute}}{\\text{kg of solvent}} = \\dfrac{${f(nsol)}}{${kg}}`)} = ${f(molality)} mol/kg.`), molality, [nsol * kg, nsol / (kg * 1000), molality * 2], "mol/kg");
  },
  (r) => {
    const n1 = r.int(1, 5), n2 = r.int(1, 9);
    const x = n1 / (n1 + n2);
    return num(r, B("Solutions", "Mole fraction", "Easy", `A solution contains ${n1} mol of ethanol and ${n2} mol of water. The mole fraction of ethanol is`, `${m(`x = \\dfrac{${n1}}{${n1}+${n2}}`)} = ${ratio(x)}.`), x, [n1 / n2, n2 / (n1 + n2), 1 / (n1 + n2)], "", ratio);
  },
  (r) => {
    const g = r.pick([{ tex: "O_2", M: 32 }, { tex: "N_2", M: 28 }, { tex: "CO_2", M: 44 }, { tex: "CH_4", M: 16 }, { tex: "NH_3", M: 17 }, { tex: "H_2", M: 2 }]), n = r.pick([0.25, 0.5, 1, 2, 3]);
    const V = n * 22.4;
    return num(r, B("Some Basic Concepts of Chemistry", "Molar volume", "Easy", `The volume occupied by ${f(n * g.M)} g of ${m(g.tex)} at STP is (molar volume = 22.4 L)`, `Moles ${m(`= ${f(n * g.M)}/${g.M} = ${f(n)}`)}; volume ${m(`= ${f(n)}\\times22.4`)} = ${f(V)} L.`), V, [n * g.M * 22.4, 22.4 / n, V / 2], "L");
  },
  (r) => {
    const nH2 = r.pick([2, 3, 4, 5, 6, 8]), nO2 = r.pick([1, 2, 3, 4]);
    const water = Math.min(nH2, 2 * nO2) * 18;
    return num(r, B("Some Basic Concepts of Chemistry", "Limiting reagent", "Medium", `${nH2 * 2} g of ${m("H_2")} reacts with ${nO2 * 32} g of ${m("O_2")} according to ${m("2H_2 + O_2 \\rightarrow 2H_2O")}. The mass of water formed is`, `Moles: ${m(`H_2 = ${nH2}`)}, ${m(`O_2 = ${nO2}`)}. ${nH2 <= 2 * nO2 ? m("H_2") : m("O_2")} is limiting ⇒ ${Math.min(nH2, 2 * nO2)} mol water = ${water} g.`), water, [Math.max(nH2, 2 * nO2) * 18, (nH2 * 2 + nO2 * 32), nO2 * 18], "g");
  },
  (r) => {
    const hc = r.pick([{ tex: "CH_4", x: 1, y: 4 }, { tex: "C_2H_6", x: 2, y: 6 }, { tex: "C_3H_8", x: 3, y: 8 }, { tex: "C_2H_4", x: 2, y: 4 }, { tex: "C_4H_{10}", x: 4, y: 10 }, { tex: "C_2H_2", x: 2, y: 2 }, { tex: "C_6H_6", x: 6, y: 6 }]);
    const o2 = hc.x + hc.y / 4;
    return num(r, B("Some Basic Concepts of Chemistry", "Stoichiometry", "Medium", `The number of moles of ${m("O_2")} required for complete combustion of 1 mol of ${m(hc.tex)} is`, `${m(`C_xH_y + (x + y/4)O_2 \\rightarrow xCO_2 + \\tfrac{y}{2}H_2O`)} ⇒ ${m(`${hc.x} + ${hc.y}/4`)} = ${f(o2)} mol.`), o2, [hc.x + hc.y / 2, hc.x, hc.x + hc.y], "mol");
  },
  // ---------------------------------------------------------------- Atomic structure
  (r) => {
    const sp = r.pick([
      { s: "^{23}_{11}Na^{+}", p: 11, n: 12, e: 10 }, { s: "^{35}_{17}Cl^{-}", p: 17, n: 18, e: 18 }, { s: "^{24}_{12}Mg^{2+}", p: 12, n: 12, e: 10 }, { s: "^{16}_{8}O^{2-}", p: 8, n: 8, e: 10 },
      { s: "^{56}_{26}Fe^{3+}", p: 26, n: 30, e: 23 }, { s: "^{27}_{13}Al^{3+}", p: 13, n: 14, e: 10 }, { s: "^{40}_{20}Ca^{2+}", p: 20, n: 20, e: 18 }, { s: "^{32}_{16}S^{2-}", p: 16, n: 16, e: 18 },
      { s: "^{39}_{19}K^{+}", p: 19, n: 20, e: 18 }, { s: "^{19}_{9}F^{-}", p: 9, n: 10, e: 10 },
    ]);
    const ask = r.pick(["electrons", "neutrons"] as const);
    const ans = ask === "electrons" ? sp.e : sp.n;
    return num(r, B("Structure of Atom", "Subatomic particles", "Easy", `The number of ${ask} in the ion ${m(sp.s)} is`, `Protons = ${sp.p}, neutrons = ${sp.n}, electrons = ${sp.e}.`), ans, [sp.p, ask === "electrons" ? sp.n : sp.e, sp.p + sp.n]);
  },
  (r) => {
    const n = r.int(1, 5);
    const E = -13.6 / (n * n);
    return num(r, B("Structure of Atom", "Bohr model", "Easy", `The energy of an electron in the n = ${n} orbit of a hydrogen atom is`, `${m(`E_n = -\\dfrac{13.6}{n^2} = -\\dfrac{13.6}{${n * n}}`)} = ${f(E)} eV.`), E, [-13.6 / n, 13.6 / (n * n), -13.6 * n * n], "eV");
  },
  (r) => {
    const n = r.int(2, 6);
    return num(r, B("Structure of Atom", "Electronic shells", "Easy", `The maximum number of electrons that can be accommodated in the shell with n = ${n} is`, `Maximum electrons ${m("= 2n^2")} = ${2 * n * n}.`), 2 * n * n, [n * n, 2 * n, 2 * (n - 1) * (n - 1) || 4]);
  },
  (r) => {
    const orb = r.pick([{ o: "2s", n: 2, l: 0 }, { o: "3s", n: 3, l: 0 }, { o: "3p", n: 3, l: 1 }, { o: "4s", n: 4, l: 0 }, { o: "4p", n: 4, l: 1 }, { o: "3d", n: 3, l: 2 }, { o: "4d", n: 4, l: 2 }, { o: "5p", n: 5, l: 1 }, { o: "4f", n: 4, l: 3 }, { o: "5d", n: 5, l: 2 }]);
    const kind = r.pick(["radial", "angular"] as const);
    const ans = kind === "radial" ? orb.n - orb.l - 1 : orb.l;
    return num(r, B("Structure of Atom", "Nodes", "Medium", `The number of ${kind} nodes in a ${orb.o} orbital is`, `Radial nodes ${m("= n - l - 1")} = ${orb.n - orb.l - 1}; angular nodes ${m("= l")} = ${orb.l}.`), ans, [kind === "radial" ? orb.l : orb.n - orb.l - 1, orb.n - 1, orb.n], "");
  },
  (r) => {
    const sub = r.pick([{ s: "s", l: 0 }, { s: "p", l: 1 }, { s: "d", l: 2 }, { s: "f", l: 3 }]);
    const ans = 2 * sub.l + 1;
    return num(r, B("Structure of Atom", "Quantum numbers", "Easy", `The number of orbitals in a ${sub.s} subshell (l = ${sub.l}) is`, `Orbitals ${m("= 2l + 1")} = ${ans}.`), ans, [2 * (2 * sub.l + 1), sub.l + 1, sub.l * sub.l || 2]);
  },
  (r) => {
    const el = r.pick(ELEMENTS);
    const u = unpaired(el.Z);
    return num(r, B("Structure of Atom", "Electronic configuration", "Medium", `The number of unpaired electrons in a ground-state ${el.s} atom (Z = ${el.Z}) is`, `Writing the configuration by the Aufbau principle${el.Z === 24 || el.Z === 29 ? " (with the half-filled/fully filled d-subshell exception)" : ""} gives ${u} unpaired electron(s).`), u, [u + 1, u + 2, Math.max(0, u - 1) === u ? u + 3 : Math.max(0, u - 1)]);
  },
  // ---------------------------------------------------------------- Chemical bonding
  (r) => {
    const mol = [
      ["CH_4", "sp^3"], ["NH_3", "sp^3"], ["H_2O", "sp^3"], ["BF_3", "sp^2"], ["C_2H_4", "sp^2"], ["C_2H_2", "sp"], ["BeCl_2", "sp"], ["PCl_5", "sp^3d"], ["SF_6", "sp^3d^2"], ["CO_2", "sp"], ["SO_3", "sp^2"], ["XeF_4", "sp^3d^2"], ["XeF_2", "sp^3d"], ["NH_4^+", "sp^3"],
    ];
    const [x, h] = r.pick(mol);
    return txt(r, B("Chemical Bonding and Molecular Structure", "Hybridisation", "Easy", `The hybridisation of the central atom in ${m(x)} is`, `Steric number (bond pairs + lone pairs) gives ${m(h)} hybridisation.`), m(h), ["sp", "sp^2", "sp^3", "sp^3d", "sp^3d^2"].map((s) => m(s)));
  },
  (r) => {
    const mol = [["H_2O", "Bent (V-shaped)"], ["NH_3", "Trigonal pyramidal"], ["CH_4", "Tetrahedral"], ["BF_3", "Trigonal planar"], ["CO_2", "Linear"], ["SF_6", "Octahedral"], ["PCl_5", "Trigonal bipyramidal"], ["XeF_4", "Square planar"], ["ClF_3", "T-shaped"], ["SF_4", "See-saw"]];
    const [x, sh] = r.pick(mol);
    return txt(r, B("Chemical Bonding and Molecular Structure", "VSEPR shapes", "Easy", `According to VSEPR theory, the shape of ${m(x)} is`, `Counting bond pairs and lone pairs on the central atom gives a ${sh.toLowerCase()} shape.`), sh, mol.map(([, s]) => s));
  },
  (r) => {
    const sp = [["O_2", 2, "paramagnetic"], ["O_2^{+}", 2.5, "paramagnetic"], ["O_2^{-}", 1.5, "paramagnetic"], ["O_2^{2-}", 1, "diamagnetic"], ["N_2", 3, "diamagnetic"], ["N_2^{+}", 2.5, "paramagnetic"], ["C_2", 2, "diamagnetic"], ["B_2", 1, "paramagnetic"], ["F_2", 1, "diamagnetic"], ["NO", 2.5, "paramagnetic"], ["CO", 3, "diamagnetic"], ["He_2^{+}", 0.5, "paramagnetic"]] as const;
    const [x, bo] = r.pick(sp);
    return num(r, B("Chemical Bonding and Molecular Structure", "Molecular orbital theory", "Medium", `According to molecular orbital theory, the bond order of ${m(x)} is`, `Bond order ${m("= \\tfrac12(N_b - N_a)")} = ${f(bo)}.`), bo, [bo + 0.5, bo - 0.5 || 3, bo + 1]);
  },
  (r) => {
    const sp = [["O_2", "paramagnetic"], ["O_2^{+}", "paramagnetic"], ["O_2^{2-}", "diamagnetic"], ["N_2", "diamagnetic"], ["B_2", "paramagnetic"], ["C_2", "diamagnetic"], ["F_2", "diamagnetic"], ["NO", "paramagnetic"]] as const;
    const pick = r.sample(sp, 4);
    const para = pick.filter(([, t]) => t === "paramagnetic");
    if (para.length !== 1) return null;
    return txt(r, B("Chemical Bonding and Molecular Structure", "Magnetic behaviour", "Medium", `Which of the following species is paramagnetic?`, `${m(para[0][0])} has unpaired electron(s) in its molecular orbitals; the others have all electrons paired.`), m(para[0][0]), pick.filter(([, t]) => t !== "paramagnetic").map(([x]) => m(x)));
  },
  // ---------------------------------------------------------------- States of matter
  (r) => {
    const P1 = r.pick([1, 2, 3]), V1 = r.pick([2, 4, 6, 10]), T1 = r.pick([300, 273, 400]), P2 = r.pick([1, 2, 4]), T2 = r.pick([300, 546, 600, 450]);
    const V2 = (P1 * V1 * T2) / (T1 * P2);
    return num(r, B("States of Matter", "Combined gas law", "Medium", `A gas occupies ${V1} L at ${P1} atm and ${T1} K. Its volume at ${P2} atm and ${T2} K will be`, `${m(`V_2 = \\dfrac{P_1V_1T_2}{T_1P_2} = \\dfrac{${P1}\\times${V1}\\times${T2}}{${T1}\\times${P2}}`)} = ${f(V2)} L.`), V2, [(P2 * V1 * T1) / (T2 * P1), (P1 * V1) / P2, (V1 * T2) / T1], "L");
  },
  (r) => {
    const pairs = [[2, 32, "H_2", "O_2"], [4, 16, "He", "CH_4"], [16, 64, "CH_4", "SO_2"], [2, 8, "H_2", "He?"], [28, 7, "N_2", "?"]] as const;
    const [M1, M2, a, b] = r.pick(pairs.slice(0, 3));
    const ratio_ = Math.sqrt(M2 / M1);
    return num(r, B("States of Matter", "Graham's law", "Medium", `The ratio of the rates of diffusion of ${m(a)} and ${m(b)} under identical conditions is`, `${m(`\\dfrac{r_1}{r_2} = \\sqrt{\\dfrac{M_2}{M_1}} = \\sqrt{\\dfrac{${M2}}{${M1}}}`)} = ${f(ratio_)} : 1.`), ratio_, [M2 / M1, Math.sqrt(M1 / M2), M1 / M2], "", (x) => `${f(x)} : 1`);
  },
  (r) => {
    const n1 = r.int(1, 4), n2 = r.int(1, 6), P = r.pick([1, 2, 3, 5, 10]);
    const p1 = (n1 / (n1 + n2)) * P;
    return num(r, B("States of Matter", "Dalton's law", "Easy", `A container holds ${n1} mol of ${m("N_2")} and ${n2} mol of ${m("O_2")} at a total pressure of ${P} atm. The partial pressure of ${m("N_2")} is`, `${m(`p_{N_2} = x_{N_2}P = \\dfrac{${n1}}{${n1 + n2}}\\times${P}`)} = ${f(p1)} atm.`), p1, [(n2 / (n1 + n2)) * P, P / 2, (n1 / n2) * P], "atm");
  },
  // ---------------------------------------------------------------- Thermodynamics
  (r) => {
    const rxn = r.pick([
      { eq: "N_2(g) + 3H_2(g) \\rightarrow 2NH_3(g)", dn: -2 },
      { eq: "CaCO_3(s) \\rightarrow CaO(s) + CO_2(g)", dn: 1 },
      { eq: "2SO_2(g) + O_2(g) \\rightarrow 2SO_3(g)", dn: -1 },
      { eq: "PCl_5(g) \\rightarrow PCl_3(g) + Cl_2(g)", dn: 1 },
      { eq: "H_2(g) + I_2(g) \\rightarrow 2HI(g)", dn: 0 },
      { eq: "C(s) + O_2(g) \\rightarrow CO_2(g)", dn: 0 },
    ]);
    const dU = r.pick([-90, -50, 40, 120, 180, -400]), T = 300, R = 8.314e-3;
    const dH = dU + rxn.dn * R * T;
    return num(r, B("Thermodynamics", "ΔH and ΔU", "Medium", `For the reaction ${m(rxn.eq)} at 300 K, ${m(`\\Delta U = ${dU}`)} kJ/mol. The value of ${m("\\Delta H")} is (R = 8.314 J mol⁻¹ K⁻¹)`, `${m("\\Delta H = \\Delta U + \\Delta n_g RT")}, ${m(`\\Delta n_g = ${rxn.dn}`)} ⇒ ${m(`\\Delta H = ${dU} + (${rxn.dn})(8.314\\times10^{-3})(300)`)} = ${f(dH)} kJ/mol.`), dH, [dU - rxn.dn * R * T || dU + 5, dU + rxn.dn * 8.314 * T, dU * 2], "kJ/mol");
  },
  (r) => {
    const dH = r.pick([20, 30, 40, 60, 90, 120]), dS = r.pick([50, 80, 100, 120, 150, 200]);
    const T = (dH * 1000) / dS;
    return num(r, B("Thermodynamics", "Gibbs energy and spontaneity", "Medium", `For a reaction, ${m(`\\Delta H = +${dH}`)} kJ/mol and ${m(`\\Delta S = +${dS}`)} J mol⁻¹ K⁻¹. Above what temperature does it become spontaneous?`, `${m("\\Delta G = \\Delta H - T\\Delta S < 0 \\Rightarrow T > \\Delta H/\\Delta S")} = ${m(`${dH * 1000}/${dS}`)} = ${f(T)} K.`), T, [dH / dS, (dS * 1000) / dH, T / 2], "K");
  },
  (r) => {
    const dH = r.pick([-100, -50, 40, 80]), T = r.pick([300, 400, 500]), dS = r.pick([-100, -40, 50, 100, 200]);
    const dG = dH - (T * dS) / 1000;
    return num(r, B("Thermodynamics", "Gibbs energy", "Easy", `For a process at ${T} K, ${m(`\\Delta H = ${dH}`)} kJ/mol and ${m(`\\Delta S = ${dS}`)} J mol⁻¹ K⁻¹. ${m("\\Delta G")} is`, `${m(`\\Delta G = \\Delta H - T\\Delta S = ${dH} - ${T}(${dS}\\times10^{-3})`)} = ${f(dG)} kJ/mol.`), dG, [dH + (T * dS) / 1000, dH - T * dS, dH], "kJ/mol");
  },
  // ---------------------------------------------------------------- Equilibrium
  (r) => {
    const e = r.int(1, 5), coef = r.pick([1, 2]), acid = r.next() < 0.5;
    const conc = coef * 10 ** -e;
    const pH = acid ? -Math.log10(conc) : 14 + Math.log10(conc);
    const species = acid ? (coef === 2 ? "H_2SO_4" : "HCl") : coef === 2 ? "Ba(OH)_2" : "NaOH";
    const molar = acid ? (coef === 2 ? 10 ** -e : 10 ** -e) : 10 ** -e;
    return num(r, B("Equilibrium", "pH of strong acids and bases", "Easy", `The pH of a ${m(sci(molar, 2).replace(/^1 \\times /, ""))} M solution of ${m(species)}${coef === 2 ? " (assume complete dissociation)" : ""} is (log 2 = 0.30)`, `${acid ? m("[H^+]") : m("[OH^-]")} ${m(`= ${coef}\\times10^{-${e}}`)} M ⇒ ${acid ? `pH ${m(`= -\\log[H^+]`)}` : `pOH = ${f(14 - pH)}, pH = 14 - pOH`} = ${f(Math.round(pH * 100) / 100)}.`), Math.round(pH * 100) / 100, [Math.round((14 - pH) * 100) / 100, e, Math.round((pH + (acid ? 0.3 : -0.3)) * 100) / 100]);
  },
  (r) => {
    const C = r.pick([0.1, 0.01, 1]), Ka = r.pick([1e-5, 1e-6, 1e-4]);
    const H = Math.sqrt(Ka * C);
    const pH = -Math.log10(H);
    return num(r, B("Equilibrium", "Weak acids", "Medium", `The pH of a ${C} M solution of a weak monobasic acid with ${m(`K_a = ${sci(Ka, 1)}`)} is`, `${m(`[H^+] = \\sqrt{K_aC} = \\sqrt{${sci(Ka, 1)}\\times${C}} = ${sci(H, 2)}`)} ⇒ pH = ${f(pH)}.`), pH, [-Math.log10(Ka * C), -Math.log10(Ka), pH + 1]);
  },
  (r) => {
    const rxn = r.pick([
      { eq: "N_2(g) + 3H_2(g) \\rightleftharpoons 2NH_3(g)", dn: -2 },
      { eq: "PCl_5(g) \\rightleftharpoons PCl_3(g) + Cl_2(g)", dn: 1 },
      { eq: "2SO_2(g) + O_2(g) \\rightleftharpoons 2SO_3(g)", dn: -1 },
      { eq: "H_2(g) + I_2(g) \\rightleftharpoons 2HI(g)", dn: 0 },
      { eq: "N_2O_4(g) \\rightleftharpoons 2NO_2(g)", dn: 1 },
      { eq: "CaCO_3(s) \\rightleftharpoons CaO(s) + CO_2(g)", dn: 1 },
    ]);
    const show = (d: number) => (d === 0 ? "K_p = K_c" : `K_p = K_c(RT)^{${d}}`);
    return txt(r, B("Equilibrium", "Kp and Kc", "Easy", `For the equilibrium ${m(rxn.eq)}, the relation between ${m("K_p")} and ${m("K_c")} is`, `${m("K_p = K_c(RT)^{\\Delta n_g}")} with ${m(`\\Delta n_g = ${rxn.dn}`)}.`), m(show(rxn.dn)), [-2, -1, 0, 1, 2].map((d) => m(show(d))));
  },
  (r) => {
    const type = r.pick(["AB", "AB2"] as const), s = r.pick([1e-3, 1e-4, 1e-5, 2e-4, 1e-2]);
    const Ksp = type === "AB" ? s * s : 4 * s ** 3;
    return num(r, B("Equilibrium", "Solubility product", "Medium", `The solubility product of a sparingly soluble salt ${m(type === "AB" ? "AB" : "AB_2")} is ${m(sci(Ksp, 3))}. Its molar solubility is`, type === "AB" ? `${m("K_{sp} = s^2 \\Rightarrow s = \\sqrt{K_{sp}}")} = ${m(sci(s, 2))} M.` : `${m("K_{sp} = 4s^3 \\Rightarrow s = (K_{sp}/4)^{1/3}")} = ${m(sci(s, 2))} M.`), s, [Math.sqrt(Ksp), type === "AB" ? Ksp / 2 : Math.cbrt(Ksp), s * 10], "M", (x) => m(sci(x, 2)));
  },
  // ---------------------------------------------------------------- Redox
  (r) => {
    const items = [["S", "H_2SO_4", 6], ["Mn", "KMnO_4", 7], ["Cr", "K_2Cr_2O_7", 6], ["N", "HNO_3", 5], ["N", "NH_3", -3], ["Cl", "KClO_3", 5], ["P", "H_3PO_4", 5], ["C", "CO", 2], ["Fe", "Fe_3O_4", 8 / 3], ["S", "Na_2S_2O_3", 2], ["O", "H_2O_2", -1], ["Cr", "CrO_5", 6], ["N", "N_2O", 1], ["Mn", "MnO_2", 4], ["S", "SO_2", 4], ["C", "CH_4", -4]] as const;
    const [el, cmp, ox] = r.pick(items);
    return num(r, B("Redox Reactions", "Oxidation number", "Easy", `The oxidation number of ${el} in ${m(cmp)} is`, `Taking O = −2 (−1 in peroxides), H = +1 and alkali metals = +1, the sum of oxidation numbers is zero ⇒ ${el} = ${ratio(ox)}.`), ox, [ox + 1, ox - 2, -ox || 2], "", (x) => (Number.isInteger(x) ? (x > 0 ? `+${x}` : String(x)) : ratio(x)));
  },
  // ---------------------------------------------------------------- Electrochemistry
  (r) => {
    const cells = [
      { c: "Zn|Zn^{2+}||Cu^{2+}|Cu", an: -0.76, ca: 0.34 }, { c: "Mg|Mg^{2+}||Ag^{+}|Ag", an: -2.37, ca: 0.8 }, { c: "Fe|Fe^{2+}||Cu^{2+}|Cu", an: -0.44, ca: 0.34 },
      { c: "Zn|Zn^{2+}||Ag^{+}|Ag", an: -0.76, ca: 0.8 }, { c: "Cu|Cu^{2+}||Ag^{+}|Ag", an: 0.34, ca: 0.8 }, { c: "Ni|Ni^{2+}||Cu^{2+}|Cu", an: -0.25, ca: 0.34 },
    ];
    const c = r.pick(cells);
    const E = Number((c.ca - c.an).toFixed(2));
    return num(r, B("Electrochemistry", "Standard cell potential", "Easy", `Given ${m(`E^\\circ`)} values (V): anode couple ${c.an}, cathode couple ${c.ca}. The standard emf of the cell ${m(c.c)} is`, `${m(`E^\\circ_{cell} = E^\\circ_{cathode} - E^\\circ_{anode} = ${c.ca} - (${c.an})`)} = ${f(E)} V.`), E, [Number((c.ca + c.an).toFixed(2)), Number((c.an - c.ca).toFixed(2)), Number((2 * c.ca - c.an).toFixed(2))], "V");
  },
  (r) => {
    const met = r.pick([{ s: "Cu", M: 63.5, n: 2 }, { s: "Ag", M: 108, n: 1 }, { s: "Zn", M: 65, n: 2 }, { s: "Al", M: 27, n: 3 }]);
    const I = r.pick([0.5, 1, 1.93, 2, 5, 9.65]), t = r.pick([965, 1930, 9650, 3860]);
    const w = (I * t * met.M) / (met.n * 96500);
    return num(r, B("Electrochemistry", "Faraday's laws", "Medium", `A current of ${I} A is passed for ${t} s through a solution of a ${met.s} salt (${met.s}${met.n > 1 ? `${met.n === 2 ? "²" : "³"}⁺` : "⁺"}). The mass of ${met.s} deposited is (M = ${met.M} g/mol, F = 96500 C)`, `${m(`w = \\dfrac{ItM}{nF} = \\dfrac{${I}\\times${t}\\times${met.M}}{${met.n}\\times96500}`)} = ${f(w)} g.`), w, [(I * t * met.M) / 96500, (I * t * met.M) / (met.n * 96500 * 2), (I * t * met.n * met.M) / 96500], "g");
  },
  (r) => {
    const n = r.pick([1, 2, 3]), E = r.pick([0.5, 1, 1.1, 1.5, 2]);
    const G = -(n * 96500 * E) / 1000;
    return num(r, B("Electrochemistry", "Gibbs energy of a cell", "Medium", `For a cell reaction involving ${n} electron(s), ${m(`E^\\circ_{cell} = ${E}`)} V. The standard Gibbs energy change is (F = 96500 C)`, `${m(`\\Delta G^\\circ = -nFE^\\circ = -${n}\\times96500\\times${E}`)} J = ${f(G)} kJ/mol.`), G, [-G, -(96500 * E) / 1000 === G ? G * 2 : -(96500 * E) / 1000, G * 1000 / 96500], "kJ/mol");
  },
  // ---------------------------------------------------------------- Kinetics
  (r) => {
    const k = r.pick([0.0693, 0.693, 6.93e-3, 0.0231, 0.01386]);
    const t = 0.693 / k;
    return num(r, B("Chemical Kinetics", "First-order half-life", "Easy", `The rate constant of a first-order reaction is ${f(k)} min⁻¹. Its half-life is`, `${m(`t_{1/2} = \\dfrac{0.693}{k} = \\dfrac{0.693}{${f(k)}}`)} = ${f(t)} min.`), t, [k / 0.693, 1 / k, 2 * t], "min");
  },
  (r) => {
    const n = r.int(1, 4), t = r.pick([10, 20, 30, 15]);
    const pct = 100 / 2 ** n;
    return num(r, B("Chemical Kinetics", "First-order decay", "Easy", `A first-order reaction has a half-life of ${t} min. The percentage of reactant left after ${n * t} min is`, `${n} half-lives ⇒ ${m(`100/2^{${n}}`)} = ${f(pct)}%.`), pct, [100 - pct, 100 / (2 * n), pct / 2], "%");
  },
  (r) => {
    const order = r.int(0, 3), k = r.pick([2, 3]);
    const factor = k ** order;
    return num(r, B("Chemical Kinetics", "Order of reaction", "Medium", `For a reaction of order ${order} with respect to A, the concentration of A is made ${k} times. The rate becomes`, `Rate ${m(`\\propto [A]^{${order}}`)} ⇒ factor ${m(`${k}^{${order}} = ${factor}`)}.`), factor, [k * order || k, k ** (order + 1), order + k], "times");
  },
  (r) => {
    const i = r.pick([{ s: "glucose", i: 1 }, { s: "NaCl", i: 2 }, { s: "CaCl_2", i: 3 }, { s: "K_2SO_4", i: 3 }, { s: "urea", i: 1 }, { s: "MgSO_4", i: 2 }]);
    const mol = r.pick([0.1, 0.2, 0.5, 1]), Kf = 1.86;
    const dT = i.i * Kf * mol;
    return num(r, B("Solutions", "Colligative properties", "Medium", `The depression in freezing point of a ${mol} molal aqueous solution of ${m(i.s)} (assume complete dissociation, ${m("K_f = 1.86")} K kg mol⁻¹) is`, `${m(`\\Delta T_f = iK_fm = ${i.i}\\times1.86\\times${mol}`)} = ${f(dT)} K.`), dT, [Kf * mol === dT ? dT * 2 : Kf * mol, (i.i + 1) * Kf * mol, dT / 2], "K");
  },
  (r) => {
    const p0 = r.pick([100, 120, 150, 200, 760]), xs = r.pick([0.05, 0.1, 0.2, 0.25]);
    const p = p0 * (1 - xs);
    return num(r, B("Solutions", "Raoult's law", "Easy", `The vapour pressure of a pure solvent is ${p0} mm Hg. A non-volatile solute is added so that its mole fraction is ${xs}. The vapour pressure of the solution is`, `${m(`p = p^\\circ x_{solvent} = ${p0}\\times${f(1 - xs)}`)} = ${f(p)} mm Hg.`), p, [p0 * xs, p0, p0 * (1 + xs)], "mm Hg");
  },
  // ---------------------------------------------------------------- Organic chemistry
  (r) => {
    const fm = r.pick([{ t: "C_6H_6", c: 6, h: 6, n: 0, x: 0 }, { t: "C_4H_8", c: 4, h: 8, n: 0, x: 0 }, { t: "C_3H_4", c: 3, h: 4, n: 0, x: 0 }, { t: "C_7H_8", c: 7, h: 8, n: 0, x: 0 }, { t: "C_5H_5N", c: 5, h: 5, n: 1, x: 0 }, { t: "C_8H_{10}", c: 8, h: 10, n: 0, x: 0 }, { t: "C_6H_{10}", c: 6, h: 10, n: 0, x: 0 }, { t: "C_2H_3Cl", c: 2, h: 3, n: 0, x: 1 }, { t: "C_{10}H_8", c: 10, h: 8, n: 0, x: 0 }]);
    const dbe = fm.c + 1 + fm.n / 2 - (fm.h + fm.x) / 2;
    return num(r, B("Organic Chemistry – Basic Principles", "Degree of unsaturation", "Medium", `The degree of unsaturation (double bond equivalent) of ${m(fm.t)} is`, `${m("DBE = C + 1 + \\tfrac{N}{2} - \\tfrac{H + X}{2}")} = ${dbe}.`), dbe, [dbe + 1, dbe - 1 < 0 ? dbe + 2 : dbe - 1, fm.c]);
  },
  (r) => {
    const groups = [["CH_3CHO", "Aldehyde"], ["CH_3COCH_3", "Ketone"], ["CH_3COOH", "Carboxylic acid"], ["CH_3CH_2OH", "Alcohol"], ["CH_3OCH_3", "Ether"], ["CH_3COOCH_3", "Ester"], ["CH_3CONH_2", "Amide"], ["CH_3NH_2", "Amine"], ["CH_3CN", "Nitrile"], ["C_6H_5OH", "Phenol"]] as const;
    const [x, g] = r.pick(groups);
    return txt(r, B("Organic Chemistry – Basic Principles", "Functional groups", "Easy", `The functional group present in ${m(x)} is`, `${m(x)} is an ${g.toLowerCase()}.`), g, groups.map(([, y]) => y));
  },
  (r) => {
    const iso = [["C_4H_{10}", 2], ["C_5H_{12}", 3], ["C_6H_{14}", 5], ["C_7H_{16}", 9], ["C_3H_8O\\text{ (alcohols)}", 2], ["C_4H_9Cl", 4], ["C_4H_{10}O\\text{ (alcohols)}", 4]] as const;
    const [x, n] = r.pick(iso);
    return num(r, B("Organic Chemistry – Basic Principles", "Structural isomerism", "Medium", `The number of structural isomers possible for ${m(x)} is`, `Drawing all chain and position isomers gives ${n}.`), n, [n + 1, n - 1, n + 2]);
  },
  (r) => {
    const names = [["CH_3CH_2CH_2CH_3", "Butane"], ["CH_3CH(CH_3)CH_3", "2-Methylpropane"], ["CH_3CH=CH_2", "Propene"], ["CH \\equiv CH", "Ethyne"], ["CH_3CH_2OH", "Ethanol"], ["CH_3COOH", "Ethanoic acid"], ["HCHO", "Methanal"], ["CH_3COCH_3", "Propanone"], ["CH_3CH(OH)CH_3", "Propan-2-ol"], ["(CH_3)_3C-OH", "2-Methylpropan-2-ol"], ["CH_2=CH-CH=CH_2", "Buta-1,3-diene"]] as const;
    const [x, n] = r.pick(names);
    return txt(r, B("Organic Chemistry – Basic Principles", "IUPAC nomenclature", "Easy", `The IUPAC name of ${m(x)} is`, `Longest chain and lowest locants give ${n}.`), n, names.map(([, y]) => y));
  },
  // ---------------------------------------------------------------- Inorganic facts
  (r) => {
    const facts: [string, string, string[]][] = [
      ["The most electronegative element is", "Fluorine", ["Oxygen", "Chlorine", "Nitrogen"]],
      ["The element with the highest first ionisation enthalpy is", "Helium", ["Neon", "Fluorine", "Hydrogen"]],
      ["The most abundant element in the Earth's crust is", "Oxygen", ["Silicon", "Aluminium", "Iron"]],
      ["The strongest reducing agent among alkali metals in aqueous solution is", "Lithium", ["Sodium", "Potassium", "Caesium"]],
      ["The gas evolved when zinc reacts with dilute sulphuric acid is", "Hydrogen", ["Oxygen", "Sulphur dioxide", "Hydrogen sulphide"]],
      ["The chemical formula of Plaster of Paris is", "CaSO₄·½H₂O", ["CaSO₄·2H₂O", "CaSO₄", "CaCO₃"]],
      ["The ore of aluminium is", "Bauxite", ["Haematite", "Cinnabar", "Galena"]],
      ["Which noble gas is most commonly used in advertisement glow lights?", "Neon", ["Argon", "Krypton", "Helium"]],
      ["The metal that is liquid at room temperature is", "Mercury", ["Gallium", "Caesium", "Bromine"]],
      ["The chemical formula of laughing gas is", "N₂O", ["NO", "NO₂", "N₂O₅"]],
      ["The hybridisation of carbon in diamond is", "sp³", ["sp²", "sp", "sp³d"]],
      ["Brass is an alloy of", "Copper and zinc", ["Copper and tin", "Iron and carbon", "Zinc and tin"]],
      ["Which element shows the maximum number of oxidation states among 3d metals?", "Manganese", ["Chromium", "Iron", "Copper"]],
      ["The colour of K₂Cr₂O₇ solution is", "Orange", ["Yellow", "Purple", "Green"]],
      ["The chemical formula of bleaching powder is", "Ca(OCl)Cl", ["CaCl₂", "NaOCl", "CaO"]],
      ["The functional isomer of ethanol is", "Dimethyl ether", ["Ethanal", "Methanol", "Ethanoic acid"]],
      ["The monomer of natural rubber is", "Isoprene", ["Ethylene", "Chloroprene", "Styrene"]],
      ["The polymer Teflon is made from the monomer", "Tetrafluoroethene", ["Chloroethene", "Ethene", "Styrene"]],
      ["Chemically, vitamin C is known as", "Ascorbic acid", ["Retinol", "Calciferol", "Tocopherol"]],
      ["The sugar present in milk is", "Lactose", ["Sucrose", "Maltose", "Fructose"]],
      ["Deficiency of vitamin D causes", "Rickets", ["Scurvy", "Beri-beri", "Night blindness"]],
      ["The bond between two amino acids in a protein is", "Peptide bond", ["Glycosidic bond", "Ester bond", "Hydrogen bond"]],
      ["Aspirin is chemically", "Acetylsalicylic acid", ["Salicylic acid", "Methyl salicylate", "Paracetamol"]],
      ["The catalyst used in the Haber process is", "Iron", ["Platinum", "Nickel", "Vanadium pentoxide"]],
      ["The catalyst used in the Contact process (modern) is", "V₂O₅", ["Fe", "Pt", "Ni"]],
    ];
    const [q, a, wr] = r.pick(facts);
    return txt(r, B("General Chemistry", "Facts and applications", "Easy", q, `${a} is correct.`), a, wr);
  },
];
