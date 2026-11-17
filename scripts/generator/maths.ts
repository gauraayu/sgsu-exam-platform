import { f, frac, gcd, m, num, ratio, txt, type Template } from "./core";

const B = (topic: string, subtopic: string, difficulty: "Easy" | "Medium", q: string, sol: string) => ({ topic, subtopic, difficulty, q, sol });
const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
const C = (n: number, k: number): number => (k < 0 || k > n ? 0 : Math.round(fact(n) / (fact(k) * fact(n - k))));
const P = (n: number, k: number): number => Math.round(fact(n) / fact(n - k));
const sgn = (x: number) => (x < 0 ? `- ${Math.abs(x)}` : `+ ${x}`);
/** Polynomial term formatting: coefficient c with variable v (drops 1s and zeros). */
const term = (c: number, v: string, first = false) => {
  if (c === 0) return "";
  const s = c < 0 ? "-" : first ? "" : "+";
  const a = Math.abs(c);
  return `${s} ${a === 1 && v ? "" : a}${v}`.trim();
};

export const maths: Template[] = [
  // ---------------------------------------------------------------- Quadratic equations
  (r) => {
    const a = r.int(-9, 9), b = r.int(-9, 9);
    if (a === b || a === 0 || b === 0) return null;
    const s = a + b, p = a * b;
    return num(r, B("Quadratic Equations", "Sum and product of roots", "Easy", `If ${m("\\alpha, \\beta")} are the roots of ${m(`x^2 ${term(-s, "x") || ""} ${sgn(p)} = 0`)}, then ${m("\\alpha^2 + \\beta^2")} equals`, `${m(`\\alpha+\\beta = ${s}`)}, ${m(`\\alpha\\beta = ${p}`)} ⇒ ${m(`\\alpha^2+\\beta^2 = (${s})^2 - 2(${p}) = ${s * s - 2 * p}`)}.`), s * s - 2 * p, [s * s + 2 * p, s * s - p, s * s]);
  },
  (r) => {
    const a = r.int(1, 6), b = r.int(-12, 12), c = r.int(-12, 12);
    const D = b * b - 4 * a * c;
    const kind = D > 0 ? (Number.isInteger(Math.sqrt(D)) ? "Real, distinct and rational" : "Real, distinct and irrational") : D === 0 ? "Real and equal" : "Non-real (complex conjugates)";
    return txt(r, B("Quadratic Equations", "Nature of roots", "Easy", `The roots of ${m(`${term(a, "x^2", true)} ${term(b, "x")} ${c ? sgn(c) : ""} = 0`)} are`, `Discriminant ${m(`D = b^2 - 4ac = ${b * b} - ${4 * a * c} = ${D}`)} ⇒ ${kind.toLowerCase()}.`), kind, ["Real, distinct and rational", "Real, distinct and irrational", "Real and equal", "Non-real (complex conjugates)"]);
  },
  (r) => {
    const a = r.int(1, 5), b = r.int(2, 12);
    const k = (b * b) / (4 * a);
    if (!Number.isInteger(k)) return null;
    return num(r, B("Quadratic Equations", "Equal roots", "Easy", `The value of k for which ${m(`${term(a, "x^2", true)} - ${b}x + k = 0`)} has equal roots is`, `${m(`D = 0 \\Rightarrow ${b}^2 = 4(${a})k \\Rightarrow k = ${k}`)}.`), k, [b / (2 * a), (b * b) / a, -k]);
  },
  (r) => {
    const a = r.int(1, 4), b = r.int(-10, 10), c = r.int(-10, 10);
    const xv = -b / (2 * a), yv = c - (b * b) / (4 * a);
    return num(r, B("Quadratic Equations", "Minimum value", "Medium", `The minimum value of ${m(`f(x) = ${term(a, "x^2", true)} ${term(b, "x")} ${c ? sgn(c) : ""}`)} for real x is`, `Minimum at ${m(`x = -\\tfrac{b}{2a} = ${f(xv)}`)}; ${m(`f_{min} = c - \\tfrac{b^2}{4a} = ${f(yv)}`)}.`), yv, [c, -yv || yv + 1, c + (b * b) / (4 * a)], "", (x) => ratio(x));
  },
  // ---------------------------------------------------------------- Sequences
  (r) => {
    const a = r.int(-10, 20), d = r.int(-5, 9), n = r.int(10, 40);
    if (d === 0) return null;
    const an = a + (n - 1) * d;
    return num(r, B("Sequences and Series", "Arithmetic progression", "Easy", `The ${n}th term of the AP ${a}, ${a + d}, ${a + 2 * d}, … is`, `${m(`a_n = a + (n-1)d = ${a} + ${n - 1}(${d}) = ${an}`)}.`), an, [a + n * d, a + (n - 2) * d, n * d]);
  },
  (r) => {
    const a = r.int(1, 15), d = r.int(1, 7), n = r.int(10, 30);
    const S = (n / 2) * (2 * a + (n - 1) * d);
    return num(r, B("Sequences and Series", "Sum of an AP", "Easy", `The sum of the first ${n} terms of the AP ${a}, ${a + d}, ${a + 2 * d}, … is`, `${m(`S_n = \\tfrac{n}{2}[2a + (n-1)d] = \\tfrac{${n}}{2}[${2 * a} + ${(n - 1) * d}] = ${S}`)}.`), S, [(n / 2) * (2 * a + n * d), n * (2 * a + (n - 1) * d), (n / 2) * (a + (n - 1) * d)]);
  },
  (r) => {
    const a = r.int(1, 5), q = r.pick([2, 3, -2]), n = r.int(5, 9);
    const S = (a * (q ** n - 1)) / (q - 1);
    return num(r, B("Sequences and Series", "Geometric progression", "Medium", `The sum of the first ${n} terms of the GP ${a}, ${a * q}, ${a * q * q}, … is`, `${m(`S_n = \\dfrac{a(r^n - 1)}{r - 1} = \\dfrac{${a}((${q})^{${n}} - 1)}{${q - 1}} = ${S}`)}.`), S, [(a * (q ** (n + 1) - 1)) / (q - 1), a * q ** (n - 1), (a * (q ** n + 1)) / (q - 1)]);
  },
  (r) => {
    const a = r.int(1, 20), den = r.pick([2, 3, 4, 5]), sign = r.pick([1, -1]);
    const S = a / (1 - sign / den);
    return num(r, B("Sequences and Series", "Infinite GP", "Easy", `The sum to infinity of the GP ${m(`${a}, ${frac(sign * a, den)}, ${frac(a, den * den)}, \\ldots`)} is`, `${m(`S_\\infty = \\dfrac{a}{1-r}`)} with ${m(`r = ${frac(sign, den)}`)} ⇒ ${ratio(S)}.`), S, [a / (1 + sign / den), a * den, a / (1 - 1 / (den * den))], "", ratio);
  },
  (r) => {
    const a = r.int(1, 30), b = r.int(1, 30);
    if (a === b) return null;
    const AM = (a + b) / 2, GM = Math.sqrt(a * b), HM = (2 * a * b) / (a + b);
    if (!Number.isInteger(GM)) return null;
    return num(r, B("Sequences and Series", "Means", "Easy", `The harmonic mean of ${a} and ${b} is`, `${m(`HM = \\dfrac{2ab}{a+b} = \\dfrac{${2 * a * b}}{${a + b}}`)} = ${ratio(HM)}. (Check: ${m("GM^2 = AM\\cdot HM")}.)`), HM, [AM, GM, (a * b) / (a + b)], "", ratio);
  },
  (r) => {
    const n = r.int(5, 30), which = r.pick(["squares", "cubes", "naturals"] as const);
    const S = which === "naturals" ? (n * (n + 1)) / 2 : which === "squares" ? (n * (n + 1) * (2 * n + 1)) / 6 : ((n * (n + 1)) / 2) ** 2;
    const formula = which === "naturals" ? "\\tfrac{n(n+1)}{2}" : which === "squares" ? "\\tfrac{n(n+1)(2n+1)}{6}" : "\\left[\\tfrac{n(n+1)}{2}\\right]^2";
    return num(r, B("Sequences and Series", "Special series", "Easy", `The value of ${m(`\\sum_{k=1}^{${n}} k${which === "squares" ? "^2" : which === "cubes" ? "^3" : ""}`)} is`, `Using ${m(formula)} with n = ${n}: ${S}.`), S, [which === "naturals" ? n * n : (n * (n + 1)) / 2, which === "squares" ? ((n * (n + 1)) / 2) ** 2 : (n * (n + 1) * (2 * n + 1)) / 6, S - n]);
  },
  // ---------------------------------------------------------------- Binomial theorem
  (r) => {
    const n = r.int(4, 10), k = r.int(1, n - 1), a = r.int(1, 3), b = r.pick([1, 2, -1, -2, 3]);
    const coef = C(n, k) * a ** (n - k) * b ** k;
    return num(r, B("Binomial Theorem", "General term", "Medium", `The coefficient of ${m(`x^{${k}}`)} in the expansion of ${m(`(${a} ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}x)^{${n}}`)} is`, `${m(`T_{k+1} = {}^{${n}}C_{${k}}(${a})^{${n - k}}(${b}x)^{${k}}`)} ⇒ coefficient ${m(`= ${C(n, k)}\\times${a ** (n - k)}\\times${b ** k} = ${coef}`)}.`), coef, [C(n, k), C(n, k) * b ** k, C(n, k + 1) * a ** (n - k - 1) * b ** (k + 1)]);
  },
  (r) => {
    const n = r.pick([4, 6, 8, 10, 12]), p = r.pick([1, 2]), q = r.pick([1, 2]);
    // (p x + q/x)^n constant term: x^(n-2k)=0 → k=n/2
    const k = n / 2;
    const c = C(n, k) * p ** (n - k) * q ** k;
    return num(r, B("Binomial Theorem", "Term independent of x", "Medium", `The term independent of x in ${m(`\\left(${p === 1 ? "" : p}x + \\dfrac{${q}}{x}\\right)^{${n}}`)} is`, `General term has ${m(`x^{${n}-2k}`)}; constant when ${m(`k = ${k}`)} ⇒ ${m(`{}^{${n}}C_{${k}}\\,${p}^{${n - k}}\\,${q}^{${k}} = ${c}`)}.`), c, [C(n, k), C(n, k - 1) * p ** (n - k + 1) * q ** (k - 1), 2 ** n]);
  },
  (r) => {
    const n = r.int(5, 15);
    return num(r, B("Binomial Theorem", "Number of terms and coefficients", "Easy", `The sum of all binomial coefficients in the expansion of ${m(`(1 + x)^{${n}}`)} is`, `Put x = 1: ${m(`\\sum {}^{${n}}C_r = 2^{${n}} = ${2 ** n}`)}.`), 2 ** n, [2 ** (n - 1), n + 1, 2 * n]);
  },
  // ---------------------------------------------------------------- Permutations & combinations
  (r) => {
    const n = r.int(5, 12), k = r.int(2, 4);
    return num(r, B("Permutations and Combinations", "Combinations", "Easy", `In how many ways can a committee of ${k} be chosen from ${n} people?`, `${m(`{}^{${n}}C_{${k}} = ${C(n, k)}`)}.`), C(n, k), [P(n, k), C(n, k - 1), C(n + 1, k)]);
  },
  (r) => {
    const n = r.int(4, 8), k = r.int(2, Math.min(4, n));
    return num(r, B("Permutations and Combinations", "Permutations", "Easy", `In how many ways can ${k} prizes (all different) be given to ${n} students if no student gets more than one prize?`, `${m(`{}^{${n}}P_{${k}} = ${P(n, k)}`)}.`), P(n, k), [C(n, k), n ** k, k ** n > 1e6 ? P(n, k) * 2 : k ** n]);
  },
  (r) => {
    const words = [
      { w: "APPLE", reps: [2] }, { w: "BANANA", reps: [3, 2] }, { w: "LETTER", reps: [2, 2] }, { w: "SCHOOL", reps: [2] }, { w: "COMMITTEE", reps: [2, 2, 2] },
      { w: "MISSISSIPPI", reps: [4, 4, 2] }, { w: "ENGINEERING", reps: [3, 3, 2, 2] }, { w: "STATISTICS", reps: [3, 3, 2] }, { w: "INDIA", reps: [2] }, { w: "MATHEMATICS", reps: [2, 2, 2] }, { w: "PHYSICS", reps: [2] }, { w: "CHEMISTRY", reps: [] },
    ];
    const w = r.pick(words);
    const ans = fact(w.w.length) / w.reps.reduce((a, x) => a * fact(x), 1);
    return num(r, B("Permutations and Combinations", "Arrangements with repetition", "Medium", `The number of distinct arrangements of the letters of the word ${w.w} is`, `${m(`\\dfrac{${w.w.length}!}{${w.reps.map((x) => `${x}!`).join("\\,") || "1"}} = ${ans}`)}.`), ans, [fact(w.w.length), ans / 2, ans * 2]);
  },
  (r) => {
    const n = r.int(4, 9);
    return num(r, B("Permutations and Combinations", "Circular permutations", "Easy", `In how many ways can ${n} people be seated around a round table?`, `Circular arrangements ${m(`= (n-1)! = ${n - 1}! = ${fact(n - 1)}`)}.`), fact(n - 1), [fact(n), fact(n - 1) / 2, fact(n - 2)]);
  },
  (r) => {
    const n = r.int(5, 15);
    const d = (n * (n - 3)) / 2;
    return num(r, B("Permutations and Combinations", "Geometrical counting", "Easy", `The number of diagonals of a convex polygon with ${n} sides is`, `${m(`{}^{${n}}C_2 - ${n} = \\dfrac{n(n-3)}{2} = ${d}`)}.`), d, [C(n, 2), d + n, n * (n - 2)]);
  },
  // ---------------------------------------------------------------- Complex numbers
  (r) => {
    const a = r.int(-9, 9), b = r.int(-9, 9);
    if (a === 0 && b === 0) return null;
    const mod2 = a * a + b * b;
    const s = Math.sqrt(mod2);
    return num(r, B("Complex Numbers", "Modulus", "Easy", `The modulus of ${m(`z = ${a} ${b < 0 ? "-" : "+"} ${Math.abs(b)}i`)} is`, `${m(`|z| = \\sqrt{${a}^2 + ${b}^2} = \\sqrt{${mod2}}`)}.`), s, [Math.abs(a) + Math.abs(b), mod2, Math.abs(a - b) || 1], "", (x) => (Number.isInteger(x) ? String(x) : m(`\\sqrt{${Math.round(x * x)}}`)));
  },
  (r) => {
    const n = r.int(10, 200);
    const k = n % 4;
    const val = ["1", "i", "-1", "-i"][k];
    return txt(r, B("Complex Numbers", "Powers of i", "Easy", `The value of ${m(`i^{${n}}`)}, where ${m("i = \\sqrt{-1}")}, is`, `${n} = 4×${Math.floor(n / 4)} + ${k} ⇒ ${m(`i^{${n}} = i^{${k}} = ${val}`)}.`), m(val), ["1", "i", "-1", "-i"].map(m));
  },
  (r) => {
    const a = r.int(-6, 6), b = r.int(-6, 6), c = r.int(-6, 6), d = r.int(-6, 6);
    if (!b || !d) return null;
    const re = a * c - b * d, im = a * d + b * c;
    const show = (x: number, y: number) => m(`${x} ${y < 0 ? "-" : "+"} ${Math.abs(y)}i`);
    return txt(r, B("Complex Numbers", "Algebra of complex numbers", "Easy", `The product ${m(`(${a} ${b < 0 ? "-" : "+"} ${Math.abs(b)}i)(${c} ${d < 0 ? "-" : "+"} ${Math.abs(d)}i)`)} equals`, `${m(`(ac - bd) + (ad + bc)i = ${re} ${im < 0 ? "-" : "+"} ${Math.abs(im)}i`)}.`), show(re, im), [show(a * c + b * d, im), show(re, a * d - b * c), show(a * c, b * d), show(-re, im)]);
  },
  (r) => {
    const opts = [[1, 1, "\\pi/4"], [1, -1, "-\\pi/4"], [-1, 1, "3\\pi/4"], [-1, -1, "-3\\pi/4"], [1, Math.sqrt(3), "\\pi/3"], [Math.sqrt(3), 1, "\\pi/6"], [-1, Math.sqrt(3), "2\\pi/3"], [0, 1, "\\pi/2"]] as const;
    const [a, b, arg] = r.pick(opts);
    const showN = (x: number) => (Math.abs(x - Math.sqrt(3)) < 1e-9 ? "\\sqrt3" : String(x));
    return txt(r, B("Complex Numbers", "Argument", "Medium", `The principal argument of ${m(`z = ${showN(a)} ${b < 0 ? "-" : "+"} ${b === 1 || b === -1 ? "" : showN(Math.abs(b))}i`)} is`, `Locate z in its quadrant and use ${m("\\tan\\theta = |b/a|")}: ${m(`\\arg z = ${arg}`)}.`), m(arg), opts.map(([, , x]) => m(x)));
  },
  // ---------------------------------------------------------------- Logarithms & functions
  (r) => {
    const b = r.pick([2, 3, 5, 10]), e = r.int(2, 6);
    const n = b ** e;
    return num(r, B("Sets, Relations and Functions", "Logarithms", "Easy", `The value of ${m(`\\log_{${b}} ${n}`)} is`, `${m(`${b}^{${e}} = ${n}`)} ⇒ ${e}.`), e, [e + 1, e - 1, n / b]);
  },
  (r) => {
    const a = r.int(1, 6), b = r.int(-9, 9), c = r.int(1, 5), d = r.int(-9, 9), x = r.int(-4, 4);
    const g = c * x + d, fg = a * g + b;
    return num(r, B("Sets, Relations and Functions", "Composition of functions", "Easy", `If ${m(`f(x) = ${term(a, "x", true)} ${b ? sgn(b) : ""}`)} and ${m(`g(x) = ${term(c, "x", true)} ${d ? sgn(d) : ""}`)}, then ${m(`(f\\circ g)(${x})`)} is`, `${m(`g(${x}) = ${g}`)}, ${m(`f(${g}) = ${fg}`)}.`), fg, [c * (a * x + b) + d, a * x + b + g, a * c * x]);
  },
  (r) => {
    const nA = r.int(10, 40), nB = r.int(10, 40), both = r.int(2, Math.min(nA, nB) - 1);
    return num(r, B("Sets, Relations and Functions", "Sets", "Easy", `In a class, ${nA} students like cricket, ${nB} like football and ${both} like both. How many like at least one of the two games?`, `${m(`n(A\\cup B) = n(A) + n(B) - n(A\\cap B) = ${nA + nB - both}`)}.`), nA + nB - both, [nA + nB, nA + nB - 2 * both, nA + nB + both]);
  },
  (r) => {
    const n = r.int(2, 5);
    const rel = 2 ** (n * n);
    return num(r, B("Sets, Relations and Functions", "Relations", "Medium", `The number of relations on a set with ${n} elements is`, `A relation is a subset of ${m("A\\times A")} which has ${n * n} elements ⇒ ${m(`2^{${n * n}} = ${rel}`)}.`), rel, [2 ** n, n * n, 2 ** (n * (n - 1))]);
  },
  // ---------------------------------------------------------------- Matrices & determinants
  (r) => {
    const a = r.int(-6, 6), b = r.int(-6, 6), c = r.int(-6, 6), d = r.int(-6, 6);
    const det = a * d - b * c;
    return num(r, B("Matrices and Determinants", "2×2 determinant", "Easy", `The value of ${m(`\\begin{vmatrix} ${a} & ${b} \\\\ ${c} & ${d} \\end{vmatrix}`)} is`, `${m(`ad - bc = (${a})(${d}) - (${b})(${c}) = ${det}`)}.`), det, [a * d + b * c, a * b - c * d, -det || det + 1]);
  },
  (r) => {
    const M = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => r.int(-3, 4)));
    const [[a, b, c], [d, e, g], [h, i, j]] = M;
    const det = a * (e * j - g * i) - b * (d * j - g * h) + c * (d * i - e * h);
    const tex = M.map((row) => row.join(" & ")).join(" \\\\ ");
    return num(r, B("Matrices and Determinants", "3×3 determinant", "Medium", `The value of ${m(`\\begin{vmatrix} ${tex} \\end{vmatrix}`)} is`, `Expanding along the first row: ${m(`${a}(${e * j - g * i}) - (${b})(${d * j - g * h}) + (${c})(${d * i - e * h}) = ${det}`)}.`), det, [a * (e * j - g * i) + b * (d * j - g * h) + c * (d * i - e * h), -det || det + 2, a * e * j - c * e * h]);
  },
  (r) => {
    const n = r.pick([2, 3]), k = r.int(2, 4), d = r.int(-5, 6);
    if (d === 0) return null;
    const ans = k ** n * d;
    return num(r, B("Matrices and Determinants", "Properties of determinants", "Easy", `If A is a square matrix of order ${n} with ${m(`|A| = ${d}`)}, then ${m(`|${k}A|`)} is`, `${m(`|kA| = k^n|A| = ${k}^{${n}}(${d}) = ${ans}`)}.`), ans, [k * d, k ** (n + 1) * d, n * k * d]);
  },
  (r) => {
    const n = r.pick([2, 3]), d = r.pick([-3, -2, 2, 3, 4, 5]);
    const ans = d ** (n - 1);
    return num(r, B("Matrices and Determinants", "Adjoint", "Medium", `If A is a non-singular matrix of order ${n} with ${m(`|A| = ${d}`)}, then ${m("|\\operatorname{adj} A|")} is`, `${m(`|\\operatorname{adj}A| = |A|^{n-1} = (${d})^{${n - 1}} = ${ans}`)}.`), ans, [d ** n, d, 1 / d], "", ratio);
  },
  (r) => {
    const rA = r.int(1, 4), cA = r.int(1, 4), cB = r.int(1, 4);
    return txt(r, B("Matrices and Determinants", "Order of a product", "Easy", `If A is of order ${rA}×${cA} and B is of order ${cA}×${cB}, the order of AB is`, `Product of ${rA}×${cA} and ${cA}×${cB} matrices is ${rA}×${cB}.`), `${rA}×${cB}`, [`${cA}×${cB}`, `${rA}×${cA}`, `${cB}×${rA}`, `${cA}×${cA}`, `${cB}×${cB}`]);
  },
  // ---------------------------------------------------------------- Trigonometry
  (r) => {
    const tbl: [string, string][] = [
      ["\\sin 30^\\circ", "\\tfrac12"], ["\\cos 60^\\circ", "\\tfrac12"], ["\\tan 45^\\circ", "1"], ["\\sin 60^\\circ", "\\tfrac{\\sqrt3}{2}"], ["\\cos 30^\\circ", "\\tfrac{\\sqrt3}{2}"], ["\\tan 60^\\circ", "\\sqrt3"], ["\\tan 30^\\circ", "\\tfrac{1}{\\sqrt3}"],
      ["\\sin 45^\\circ", "\\tfrac{1}{\\sqrt2}"], ["\\sin 120^\\circ", "\\tfrac{\\sqrt3}{2}"], ["\\cos 120^\\circ", "-\\tfrac12"], ["\\tan 135^\\circ", "-1"], ["\\sin 150^\\circ", "\\tfrac12"], ["\\cos 180^\\circ", "-1"], ["\\sin 210^\\circ", "-\\tfrac12"], ["\\cos 300^\\circ", "\\tfrac12"], ["\\tan 225^\\circ", "1"], ["\\sin 270^\\circ", "-1"], ["\\cos 150^\\circ", "-\\tfrac{\\sqrt3}{2}"],
    ];
    const [e, v] = r.pick(tbl);
    return txt(r, B("Trigonometry", "Standard values", "Easy", `The value of ${m(e)} is`, `Using the reference angle and the sign in the relevant quadrant, ${m(`${e} = ${v}`)}.`), m(v), [...new Set(tbl.map(([, x]) => x))].map(m));
  },
  (r) => {
    const tri = r.pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29]]);
    const [o, a, h] = tri;
    const ask = r.pick(["\\sin\\theta", "\\cos\\theta", "\\tan\\theta", "\\sec\\theta"]);
    const val: Record<string, [number, number]> = { "\\sin\\theta": [o, h], "\\cos\\theta": [a, h], "\\tan\\theta": [o, a], "\\sec\\theta": [h, a] };
    const [n, d] = val[ask];
    return txt(r, B("Trigonometry", "Trigonometric ratios", "Easy", `If ${m(`\\cot\\theta = ${frac(a, o)}`)} and θ is acute, then ${m(ask)} equals`, `Opposite : adjacent = ${o} : ${a}, hypotenuse = ${h} ⇒ ${m(`${ask} = ${frac(n, d)}`)}.`), m(frac(n, d)), [frac(o, h), frac(a, h), frac(o, a), frac(h, a), frac(h, o), frac(a, o)].map(m));
  },
  (r) => {
    const a = r.int(3, 12), b = r.int(3, 12), c2 = r.pick([60, 90, 120]);
    const cosv = c2 === 60 ? 0.5 : c2 === 90 ? 0 : -0.5;
    const cc = a * a + b * b - 2 * a * b * cosv;
    const s = Math.sqrt(cc);
    return num(r, B("Trigonometry", "Cosine rule", "Medium", `In a triangle, two sides are ${a} and ${b} and the included angle is ${c2}°. The third side is`, `${m(`c^2 = a^2 + b^2 - 2ab\\cos C = ${cc}`)} ⇒ ${m(`c = \\sqrt{${cc}}`)}.`), s, [Math.sqrt(a * a + b * b), Math.sqrt(a * a + b * b + 2 * a * b * cosv) || a + b, a + b], "", (x) => (Number.isInteger(Math.round(x * 1e6) / 1e6) ? String(Math.round(x)) : m(`\\sqrt{${Math.round(x * x)}}`)));
  },
  (r) => {
    const a = r.int(1, 12), b = r.int(1, 12);
    const mx = Math.sqrt(a * a + b * b);
    return num(r, B("Trigonometry", "Maximum value", "Easy", `The maximum value of ${m(`${a}\\sin x + ${b}\\cos x`)} is`, `${m(`\\max(a\\sin x + b\\cos x) = \\sqrt{a^2+b^2} = \\sqrt{${a * a + b * b}}`)}.`), mx, [a + b, a * a + b * b, Math.abs(a - b) || 1], "", (x) => (Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : m(`\\sqrt{${Math.round(x * x)}}`)));
  },
  (r) => {
    const deg = r.pick([15, 18, 20, 30, 36, 40, 45, 60, 72, 75, 90, 120, 135, 150, 210, 225, 270, 300, 330]);
    const g = gcd(deg, 180);
    return txt(r, B("Trigonometry", "Radian measure", "Easy", `${deg}° expressed in radians is`, `${m(`${deg}\\times\\tfrac{\\pi}{180} = \\tfrac{${deg / g === 1 ? "" : deg / g}\\pi}{${180 / g}}`)}.`), m(180 / g === 1 ? `${deg / g}\\pi` : `\\tfrac{${deg / g === 1 ? "" : deg / g}\\pi}{${180 / g}}`), [15, 30, 45, 60, 90, 120, 135, 150, 180, 270].filter((d) => d !== deg).map((d) => { const h = gcd(d, 180); return m(180 / h === 1 ? `${d / h}\\pi` : `\\tfrac{${d / h === 1 ? "" : d / h}\\pi}{${180 / h}}`); }));
  },
  // ---------------------------------------------------------------- Coordinate geometry
  (r) => {
    const x1 = r.int(-8, 8), y1 = r.int(-8, 8), x2 = r.int(-8, 8), y2 = r.int(-8, 8);
    const d2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (!d2) return null;
    const show = (x: number) => (Number.isInteger(Math.sqrt(Math.round(x * x))) && Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : m(`\\sqrt{${Math.round(x * x)}}`));
    return num(r, B("Straight Lines", "Distance formula", "Easy", `The distance between the points (${x1}, ${y1}) and (${x2}, ${y2}) is`, `${m(`\\sqrt{(${x2 - x1})^2 + (${y2 - y1})^2} = \\sqrt{${d2}}`)}.`), Math.sqrt(d2), [Math.abs(x2 - x1) + Math.abs(y2 - y1), Math.sqrt((x2 + x1) ** 2 + (y2 + y1) ** 2), d2], "", show);
  },
  (r) => {
    const x1 = r.int(-8, 8), y1 = r.int(-8, 8), x2 = r.int(-8, 8), y2 = r.int(-8, 8);
    if (x1 === x2) return null;
    const sl = (y2 - y1) / (x2 - x1);
    return num(r, B("Straight Lines", "Slope", "Easy", `The slope of the line joining (${x1}, ${y1}) and (${x2}, ${y2}) is`, `${m(`\\dfrac{${y2} - (${y1})}{${x2} - (${x1})} = ${frac(y2 - y1, x2 - x1)}`)}.`), sl, [(x2 - x1) / (y2 - y1 || 1), -sl || 1, (y2 + y1) / (x2 + x1 || 1)], "", ratio);
  },
  (r) => {
    const a = r.int(-6, 6), b = r.int(-6, 6), c = r.int(-20, 20), x0 = r.int(-6, 6), y0 = r.int(-6, 6);
    if (!a || !b) return null;
    const num_ = Math.abs(a * x0 + b * y0 + c), den2 = a * a + b * b;
    const d = num_ / Math.sqrt(den2);
    const sq = Math.sqrt(den2);
    const show = (x: number) => {
      const k = x * sq;
      if (Number.isInteger(sq)) return ratio(x);
      return m(`\\dfrac{${Math.round(k)}}{\\sqrt{${den2}}}`);
    };
    return num(r, B("Straight Lines", "Distance of a point from a line", "Medium", `The perpendicular distance of (${x0}, ${y0}) from the line ${m(`${term(a, "x", true)} ${term(b, "y")} ${sgn(c)} = 0`)} is`, `${m(`\\dfrac{|ax_0 + by_0 + c|}{\\sqrt{a^2+b^2}} = \\dfrac{${num_}}{\\sqrt{${den2}}}`)}.`), d, [(num_ + 2) / sq, Math.abs(a * x0 + b * y0) / sq === d ? (num_ + 4) / sq : Math.abs(a * x0 + b * y0) / sq, (num_ + 1) / sq], "", show);
  },
  (r) => {
    const h = r.int(-6, 6), k = r.int(-6, 6), rad = r.int(1, 9);
    const D = -2 * h, E = -2 * k, F = h * h + k * k - rad * rad;
    return num(r, B("Conic Sections", "Circle", "Easy", `The radius of the circle ${m(`x^2 + y^2 ${D ? term(D, "x") : ""} ${E ? term(E, "y") : ""} ${F ? sgn(F) : ""} = 0`)} is`, `Centre ${m(`(${h}, ${k})`)}, ${m(`r = \\sqrt{g^2 + f^2 - c} = \\sqrt{${h * h} + ${k * k} - (${F})} = ${rad}`)}.`), rad, [rad * rad, Math.sqrt(h * h + k * k + F) || rad + 1, rad + 1]);
  },
  (r) => {
    const a = r.int(1, 10), dir = r.pick(["y^2 = ", "x^2 = "]);
    const lr = 4 * a;
    return num(r, B("Conic Sections", "Parabola", "Easy", `The length of the latus rectum of the parabola ${m(`${dir}${4 * a}${dir.startsWith("y") ? "x" : "y"}`)} is`, `Comparing with ${m(`${dir}4a${dir.startsWith("y") ? "x" : "y"}`)}: ${m(`a = ${a}`)} ⇒ latus rectum ${m(`= 4a = ${lr}`)}.`), lr, [a, 2 * a, 8 * a]);
  },
  (r) => {
    const a = r.int(3, 10), b = r.int(1, a - 1);
    const e = Math.sqrt(1 - (b * b) / (a * a));
    const cc = a * a - b * b;
    return num(r, B("Conic Sections", "Ellipse", "Medium", `The eccentricity of the ellipse ${m(`\\dfrac{x^2}{${a * a}} + \\dfrac{y^2}{${b * b}} = 1`)} is`, `${m(`e = \\sqrt{1 - \\tfrac{b^2}{a^2}} = \\dfrac{\\sqrt{${cc}}}{${a}}`)}.`), e, [b / a, Math.sqrt(1 + (b * b) / (a * a)), cc / (a * a)], "", (x) => {
      const n2 = Math.round(x * x * a * a);
      const s = Math.sqrt(n2);
      return Number.isInteger(s) ? ratio(s / a) : m(`\\dfrac{\\sqrt{${n2}}}{${a}}`);
    });
  },
  (r) => {
    const a = r.int(2, 8), b = r.int(1, 8);
    const cc = a * a + b * b;
    return num(r, B("Conic Sections", "Hyperbola", "Medium", `The eccentricity of the hyperbola ${m(`\\dfrac{x^2}{${a * a}} - \\dfrac{y^2}{${b * b}} = 1`)} is`, `${m(`e = \\sqrt{1 + \\tfrac{b^2}{a^2}} = \\dfrac{\\sqrt{${cc}}}{${a}}`)}.`), Math.sqrt(cc) / a, [Math.sqrt(Math.abs(a * a - b * b)) / a || 0.5, b / a, cc / (a * a)], "", (x) => {
      const n2 = Math.round(x * x * a * a);
      const s = Math.sqrt(n2);
      return Number.isInteger(s) ? ratio(s / a) : m(`\\dfrac{\\sqrt{${n2}}}{${a}}`);
    });
  },
  // ---------------------------------------------------------------- Limits, derivatives, integrals
  (r) => {
    const a = r.int(1, 9), n = r.int(2, 6);
    const v = n * a ** (n - 1);
    return num(r, B("Limits and Derivatives", "Standard limits", "Easy", `The value of ${m(`\\lim_{x\\to ${a}} \\dfrac{x^{${n}} - ${a ** n}}{x - ${a}}`)} is`, `${m(`\\lim_{x\\to a}\\dfrac{x^n - a^n}{x-a} = na^{n-1} = ${n}(${a})^{${n - 1}} = ${v}`)}.`), v, [a ** n, n * a ** n, (n - 1) * a ** (n - 1)]);
  },
  (r) => {
    const a = r.int(1, 9), b = r.int(1, 9);
    if (a === b) return null;
    const kind = r.pick(["sin", "tan"]);
    return num(r, B("Limits and Derivatives", "Trigonometric limits", "Easy", `The value of ${m(`\\lim_{x\\to 0} \\dfrac{\\${kind} ${a}x}{${b}x}`)} is`, `${m(`\\lim \\dfrac{\\${kind} ${a}x}{${a}x}\\cdot\\dfrac{${a}}{${b}} = ${frac(a, b)}`)}.`), a / b, [b / a, 1, 0], "", ratio);
  },
  (r) => {
    const a = r.int(-5, 5), n = r.int(2, 5), b = r.int(-9, 9), x0 = r.int(-3, 3);
    if (!a) return null;
    const d = a * n * x0 ** (n - 1) + b;
    return num(r, B("Limits and Derivatives", "Derivatives", "Easy", `If ${m(`f(x) = ${term(a, `x^{${n}}`, true)} ${term(b, "x")}`)}, then ${m(`f'(${x0})`)} equals`, `${m(`f'(x) = ${a * n}x^{${n - 1}} ${sgn(b)}`)} ⇒ ${m(`f'(${x0}) = ${d}`)}.`), d, [a * x0 ** n + b * x0, a * n * x0 ** n + b, a * x0 ** (n - 1) + b]);
  },
  (r) => {
    const a = r.int(1, 6), b = r.int(1, 6);
    const kind = r.pick(["e^{ax}\\sin bx", "x^a e^{bx}"]);
    if (kind.startsWith("e")) {
      // derivative at 0 of e^{ax} sin bx = b
      return num(r, B("Continuity and Differentiability", "Product rule", "Medium", `If ${m(`y = e^{${a}x}\\sin ${b}x`)}, then ${m("\\dfrac{dy}{dx}")} at ${m("x = 0")} is`, `${m(`y' = e^{${a}x}(${a}\\sin ${b}x + ${b}\\cos ${b}x)`)} ⇒ at 0: ${b}.`), b, [a, a + b, a * b]);
    }
    const v = a + b; // d/dx x^a e^{bx} at x=1 = e^b (a + b) → coefficient of e^b
    return num(r, B("Continuity and Differentiability", "Product rule", "Medium", `If ${m(`y = x^{${a}}e^{${b}x}`)}, then ${m("\\dfrac{dy}{dx}")} at ${m("x = 1")} is`, `${m(`y' = e^{${b}x}(${a}x^{${a - 1}} + ${b}x^{${a}})`)} ⇒ at 1: ${m(`${v}e^{${b}}`)}.`), v, [a, b, a * b], "", (x) => m(`${x}e^{${b}}`));
  },
  (r) => {
    const a = r.int(1, 6), n = r.int(1, 4), lo = r.int(0, 2), hi = lo + r.int(1, 3);
    const I = (a * (hi ** (n + 1) - lo ** (n + 1))) / (n + 1);
    return num(r, B("Integrals", "Definite integrals", "Easy", `The value of ${m(`\\int_{${lo}}^{${hi}} ${a === 1 ? "" : a}x^{${n}}\\,dx`)} is`, `${m(`\\left[\\tfrac{${a}x^{${n + 1}}}{${n + 1}}\\right]_{${lo}}^{${hi}} = ${frac(a * (hi ** (n + 1) - lo ** (n + 1)), n + 1)}`)}.`), I, [a * (hi ** n - lo ** n), (a * (hi ** (n + 1) - lo ** (n + 1))) / n, a * n * (hi ** (n - 1) - lo ** (n - 1)) || I + 1], "", ratio);
  },
  (r) => {
    const fns = [
      ["\\int_0^{\\pi/2} \\sin x\\,dx", "1"], ["\\int_0^{\\pi} \\sin x\\,dx", "2"], ["\\int_0^{\\pi/2} \\cos^2 x\\,dx", "\\pi/4"], ["\\int_0^{1} e^x\\,dx", "e - 1"], ["\\int_1^{e} \\dfrac{dx}{x}", "1"], ["\\int_0^{1} \\dfrac{dx}{1+x^2}", "\\pi/4"],
      ["\\int_{-1}^{1} x^3\\,dx", "0"], ["\\int_0^{\\pi/4} \\sec^2 x\\,dx", "1"], ["\\int_0^{1} \\dfrac{dx}{\\sqrt{1-x^2}}", "\\pi/2"], ["\\int_0^{2\\pi} \\sin x\\,dx", "0"], ["\\int_0^{\\pi/2} \\sin^2 x\\,dx", "\\pi/4"], ["\\int_0^{\\ln 2} e^x\\,dx", "1"],
    ];
    const [e, v] = r.pick(fns);
    return txt(r, B("Integrals", "Standard definite integrals", "Easy", `The value of ${m(e)} is`, `Using the standard antiderivative and the limits: ${m(v)}.`), m(v), ["0", "1", "2", "\\pi/4", "\\pi/2", "e - 1", "\\pi", "e"].map(m));
  },
  (r) => {
    const a = r.int(1, 6);
    // area between y = x^2 and y = a x : a^3/6
    const A = a ** 3 / 6;
    return num(r, B("Application of Integrals", "Area between curves", "Medium", `The area enclosed between the curves ${m("y = x^2")} and ${m(`y = ${a === 1 ? "" : a}x`)} is`, `Intersections at x = 0, ${a}. ${m(`A = \\int_0^{${a}}(${a}x - x^2)dx = \\dfrac{${a}^3}{6} = ${frac(a ** 3, 6)}`)}.`), A, [a ** 3 / 3, a ** 2 / 2, a ** 3 / 2], "sq units", ratio);
  },
  (r) => {
    const a = r.int(1, 4), b = r.int(-6, 6), c = r.int(-9, 9);
    if (!b) return null;
    const x0 = -b / (2 * a);
    return num(r, B("Application of Derivatives", "Maxima and minima", "Easy", `The function ${m(`f(x) = ${term(a, "x^2", true)} ${term(b, "x")} ${c ? sgn(c) : ""}`)} has a local minimum at x =`, `${m(`f'(x) = ${2 * a}x ${sgn(b)} = 0 \\Rightarrow x = ${frac(-b, 2 * a)}`)}; ${m(`f''(x) = ${2 * a} > 0`)}.`), x0, [-x0, b / a, -b / a], "", ratio);
  },
  (r) => {
    const R0 = r.int(2, 10), dr = r.int(1, 5);
    const dA = 2 * R0 * dr; // coefficient of π
    return num(r, B("Application of Derivatives", "Rate of change", "Medium", `The radius of a circle increases at ${dr} cm/s. The rate of increase of its area when the radius is ${R0} cm is`, `${m(`\\dfrac{dA}{dt} = 2\\pi r\\dfrac{dr}{dt} = 2\\pi(${R0})(${dr}) = ${dA}\\pi`)} cm²/s.`), dA, [R0 * dr, R0 * R0 * dr, 2 * dr], "", (x) => `${m(`${x}\\pi`)} cm²/s`);
  },
  // ---------------------------------------------------------------- Vectors & 3D
  (r) => {
    const a = [r.int(-5, 5), r.int(-5, 5), r.int(-5, 5)], b = [r.int(-5, 5), r.int(-5, 5), r.int(-5, 5)];
    const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const v = (x: number[]) => m(`${x[0]}\\hat i ${x[1] < 0 ? "-" : "+"} ${Math.abs(x[1])}\\hat j ${x[2] < 0 ? "-" : "+"} ${Math.abs(x[2])}\\hat k`);
    return num(r, B("Vector Algebra", "Dot product", "Easy", `If ${m("\\vec a")} = ${v(a)} and ${m("\\vec b")} = ${v(b)}, then ${m("\\vec a\\cdot\\vec b")} is`, `${m(`(${a[0]})(${b[0]}) + (${a[1]})(${b[1]}) + (${a[2]})(${b[2]}) = ${dot}`)}.`), dot, [a[0] * b[0] - a[1] * b[1] + a[2] * b[2], -dot || dot + 3, a[0] + b[0] + a[1] + b[1] + a[2] + b[2]]);
  },
  (r) => {
    const a = [r.int(-4, 4), r.int(-4, 4), r.int(-4, 4)], b = [r.int(-4, 4), r.int(-4, 4), r.int(-4, 4)];
    const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const mag2 = c[0] ** 2 + c[1] ** 2 + c[2] ** 2;
    if (!mag2) return null;
    const v = (x: number[]) => m(`${x[0]}\\hat i ${x[1] < 0 ? "-" : "+"} ${Math.abs(x[1])}\\hat j ${x[2] < 0 ? "-" : "+"} ${Math.abs(x[2])}\\hat k`);
    const show = (x: number) => (Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : m(`\\sqrt{${Math.round(x * x)}}`));
    return num(r, B("Vector Algebra", "Cross product", "Medium", `The area of the parallelogram with adjacent sides ${v(a)} and ${v(b)} is`, `${m(`\\vec a\\times\\vec b = ${c[0]}\\hat i ${sgn(c[1])}\\hat j ${sgn(c[2])}\\hat k`)}; area ${m(`= |\\vec a\\times\\vec b| = \\sqrt{${mag2}}`)}.`), Math.sqrt(mag2), [Math.sqrt(mag2) / 2, Math.sqrt(mag2 + 1), Math.sqrt(mag2 * 2)], "sq units", show);
  },
  (r) => {
    const a = [r.int(-4, 4), r.int(-4, 4), r.int(-4, 4)], b = [r.int(-4, 4), r.int(-4, 4), r.int(-4, 4)];
    const k0 = r.int(-6, 6);
    // find k such that (a) · (b0, b1, k) = 0 → k = -(a0b0 + a1b1)/a2
    if (!a[2]) return null;
    const k = -(a[0] * b[0] + a[1] * b[1]) / a[2];
    void k0;
    return num(r, B("Vector Algebra", "Perpendicular vectors", "Easy", `The value of λ for which ${m(`${a[0]}\\hat i ${sgn(a[1])}\\hat j ${sgn(a[2])}\\hat k`)} is perpendicular to ${m(`${b[0]}\\hat i ${sgn(b[1])}\\hat j + \\lambda\\hat k`)} is`, `Dot product zero: ${m(`${a[0] * b[0]} + ${a[1] * b[1]} + ${a[2]}\\lambda = 0 \\Rightarrow \\lambda = ${frac(-(a[0] * b[0] + a[1] * b[1]), a[2])}`)}.`), k, [-k || 1, (a[0] * b[0] + a[1] * b[1]) / (a[2] || 1) === -k ? k + 1 : k + 2, k * 2 || 2], "", ratio);
  },
  (r) => {
    const p = [r.int(-5, 5), r.int(-5, 5), r.int(-5, 5)], n = [r.int(-4, 4), r.int(-4, 4), r.int(-4, 4)], d = r.int(-10, 10);
    const den2 = n[0] ** 2 + n[1] ** 2 + n[2] ** 2;
    if (!den2) return null;
    const nm = Math.abs(n[0] * p[0] + n[1] * p[1] + n[2] * p[2] + d);
    const sq = Math.sqrt(den2);
    const show = (x: number) => (Number.isInteger(sq) ? ratio(x) : m(`\\dfrac{${Math.round(x * sq)}}{\\sqrt{${den2}}}`));
    return num(r, B("Three Dimensional Geometry", "Distance from a plane", "Medium", `The distance of the point (${p.join(", ")}) from the plane ${m(`${term(n[0], "x", true) || "0x"} ${term(n[1], "y")} ${term(n[2], "z")} ${sgn(d)} = 0`)} is`, `${m(`\\dfrac{|${n[0]}(${p[0]}) + ${n[1]}(${p[1]}) + ${n[2]}(${p[2]}) ${sgn(d)}|}{\\sqrt{${den2}}} = \\dfrac{${nm}}{\\sqrt{${den2}}}`)}.`), nm / sq, [(nm + 1) / sq, (nm + 2) / sq, nm ? (nm - 1) / sq : 3 / sq], "", show);
  },
  (r) => {
    const a = [r.int(-5, 5), r.int(-5, 5), r.int(-5, 5)];
    const L2 = a[0] ** 2 + a[1] ** 2 + a[2] ** 2;
    const L = Math.sqrt(L2);
    if (!Number.isInteger(L) || !L) return null;
    const dc = a.map((x) => frac(x, L)).join(", ");
    return txt(r, B("Three Dimensional Geometry", "Direction cosines", "Easy", `The direction cosines of the line with direction ratios ${a.join(", ")} are`, `Divide by ${m(`\\sqrt{${L2}} = ${L}`)}: ${m(dc)}.`), m(dc), [m(a.map((x) => frac(x, L2)).join(", ")), m(a.join(", ")), m(a.map((x) => frac(-x, L)).join(", ")), m(a.map((x) => frac(x, L + 1)).join(", "))]);
  },
  // ---------------------------------------------------------------- Probability & statistics
  (r) => {
    const target = r.int(2, 12);
    const ways = 6 - Math.abs(7 - target);
    return num(r, B("Probability", "Two dice", "Easy", `Two fair dice are thrown. The probability that the sum of the numbers is ${target} is`, `Favourable outcomes = ${ways} out of 36 ⇒ ${m(frac(ways, 36))}.`), ways / 36, [(ways + 1) / 36, ways / 6 > 1 ? 1 / 6 : ways / 6, (36 - ways) / 36], "", ratio);
  },
  (r) => {
    const red = r.int(2, 8), blue = r.int(2, 8), k = 2;
    const p = (C(red, k)) / C(red + blue, k);
    return num(r, B("Probability", "Drawing without replacement", "Medium", `A bag contains ${red} red and ${blue} blue balls. Two balls are drawn at random. The probability that both are red is`, `${m(`\\dfrac{{}^{${red}}C_2}{{}^{${red + blue}}C_2} = \\dfrac{${C(red, 2)}}{${C(red + blue, 2)}} = ${frac(C(red, 2), C(red + blue, 2))}`)}.`), p, [(red / (red + blue)) ** 2, C(blue, 2) / C(red + blue, 2) === p ? (red * blue) / C(red + blue, 2) : C(blue, 2) / C(red + blue, 2), red / (red + blue)], "", ratio);
  },
  (r) => {
    const n = r.int(3, 6), k = r.int(0, n);
    const p = C(n, k) / 2 ** n;
    return num(r, B("Probability", "Binomial distribution", "Medium", `A fair coin is tossed ${n} times. The probability of getting exactly ${k} heads is`, `${m(`{}^{${n}}C_{${k}}\\left(\\tfrac12\\right)^{${n}} = \\dfrac{${C(n, k)}}{${2 ** n}}`)}.`), p, [k / n, 1 / 2 ** n === p ? (C(n, k) + 1) / 2 ** n : 1 / 2 ** n, C(n, k) / 2 ** (n - 1)], "", ratio);
  },
  (r) => {
    const pA = r.pick([0.2, 0.3, 0.4, 0.5, 0.6]), pB = r.pick([0.1, 0.2, 0.3, 0.4, 0.5]);
    const u = pA + pB - pA * pB;
    return num(r, B("Probability", "Independent events", "Easy", `A and B are independent events with P(A) = ${pA} and P(B) = ${pB}. Then ${m("P(A\\cup B)")} is`, `${m(`P(A) + P(B) - P(A)P(B) = ${pA} + ${pB} - ${f(pA * pB)} = ${f(u)}`)}.`), u, [pA + pB, pA * pB, 1 - pA * pB]);
  },
  (r) => {
    const data = Array.from({ length: r.int(5, 8) }, () => r.int(2, 20));
    const mean = data.reduce((a, x) => a + x, 0) / data.length;
    if (!Number.isInteger(mean * 2)) return null;
    const v = data.reduce((a, x) => a + (x - mean) ** 2, 0) / data.length;
    return num(r, B("Statistics", "Variance", "Medium", `The variance of the observations ${data.join(", ")} is`, `Mean ${m(`= ${f(mean)}`)}; variance ${m(`= \\tfrac1n\\sum(x_i - \\bar x)^2 = ${f(v)}`)}.`), v, [Math.sqrt(v), (v * data.length) / (data.length - 1), mean], "", (x) => (Math.abs(x * 100 - Math.round(x * 100)) < 1e-6 ? f(x) : ratio(x)));
  },
  (r) => {
    const data = Array.from({ length: r.pick([5, 7, 9, 6, 8]) }, () => r.int(1, 30));
    const s = [...data].sort((a, b) => a - b);
    const n = s.length;
    const med = n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
    const mean = data.reduce((a, x) => a + x, 0) / n;
    return num(r, B("Statistics", "Median", "Easy", `The median of ${data.join(", ")} is`, `Arranged in order: ${s.join(", ")} ⇒ median = ${f(med)}.`), med, [mean, s[Math.floor(n / 2) + 1] ?? med + 1, data[Math.floor(n / 2)]]);
  },
  (r) => {
    const n = r.int(10, 40), mean = r.int(10, 50), wrong = r.int(10, 60), right = r.int(10, 60);
    if (wrong === right) return null;
    const newMean = (n * mean - wrong + right) / n;
    return num(r, B("Statistics", "Mean", "Medium", `The mean of ${n} observations was found to be ${mean}. Later it was found that one observation was wrongly recorded as ${wrong} instead of ${right}. The correct mean is`, `Corrected sum ${m(`= ${n}\\times${mean} - ${wrong} + ${right} = ${n * mean - wrong + right}`)} ⇒ mean ${m(`= ${f(newMean)}`)}.`), newMean, [mean + (wrong - right) / n, mean, (n * mean + right) / n]);
  },
  // ---------------------------------------------------------------- Mathematical reasoning / misc
  (r) => {
    const n = r.int(10, 200), d = r.pick([2, 3, 5, 7]);
    const cnt = Math.floor(n / d);
    return num(r, B("Permutations and Combinations", "Counting", "Easy", `How many natural numbers from 1 to ${n} are divisible by ${d}?`, `${m(`\\lfloor ${n}/${d} \\rfloor = ${cnt}`)}.`), cnt, [cnt + 1, n - cnt, Math.ceil(n / d) === cnt ? cnt - 1 : Math.ceil(n / d)]);
  },
];
