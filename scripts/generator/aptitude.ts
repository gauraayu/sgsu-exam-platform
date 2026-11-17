/**
 * Aptitude templates: Quantitative Aptitude, Logical Reasoning and Verbal Ability.
 * Numeric answers are computed from the numbers in the question; verbal and fact-based items
 * come from hand-checked tables.
 */
import { f, frac, gcd, m, num, ratio, txt, type Difficulty, type Template } from "./core";

const Q = (difficulty: Difficulty, topic: string, subtopic: string, q: string, sol: string) => ({ topic, subtopic, difficulty, q, sol });
const rs = (x: number) => `₹${x.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const fmtRs = (x: number) => rs(Math.round(x * 100) / 100);
const pctFmt = (x: number) => `${f(x)}%`;
const deg = (x: number) => `${f(x)}°`;
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));
const C = (n: number, k: number) => Math.round(fact(n) / (fact(k) * fact(n - k)));
const lcm = (a: number, b: number) => (a * b) / gcd(a, b);

// =========================================================================== Quantitative Aptitude
export const quantAptitude: Template[] = [
  (r) => {
    const p = r.pick([5, 10, 12, 15, 20, 25, 30, 35, 40, 45, 60, 75]), n = r.pick([80, 120, 150, 240, 360, 400, 480, 560, 640, 720, 800, 1200]);
    const a = (p * n) / 100;
    return num(r, Q("Easy", "Percentages", "Percentage of a number", `What is ${p}% of ${n}?`, `${p}% of ${n} = ${p}/100 × ${n} = ${f(a)}.`), a, [(p * n) / 10, n - a, a + p]);
  },
  (r) => {
    const a = r.pick([10, 20, 25, 30, 40, 50]), b = r.pick([10, 20, 25, 30, 40]);
    const net = ((1 + a / 100) * (1 - b / 100) - 1) * 100;
    if (Math.abs(net) < 1e-9) return null;
    return num(r, Q("Medium", "Percentages", "Successive change", `The price of an article is increased by ${a}% and then decreased by ${b}%. The net change in price is`, `Net factor = ${f(1 + a / 100)} × ${f(1 - b / 100)} = ${f(1 + net / 100)} ⇒ net change ${f(net)}% (${net > 0 ? "increase" : "decrease"}).`), net, [a - b === net ? net + 2 : a - b, a + b, -net], "", pctFmt);
  },
  (r) => {
    const p = r.pick([10, 20, 25, 50]);
    const red = (p / (100 + p)) * 100;
    return num(r, Q("Medium", "Percentages", "Reverse percentage", `If the price of sugar rises by ${p}%, by what percentage must a family reduce its consumption so that the expenditure does not change?`, `Reduction = ${p}/(100 + ${p}) × 100 = ${f(red)}%.`), red, [p, (p / (100 - p)) * 100, red / 2], "", pctFmt);
  },
  (r) => {
    const cp = r.pick([200, 250, 400, 500, 600, 800, 1000, 1200, 1500, 2000]), pct = r.pick([5, 10, 12, 15, 20, 25, 30, 40]);
    const sp = cp * (1 + pct / 100);
    return num(r, Q("Easy", "Profit and Loss", "Selling price", `An article bought for ${rs(cp)} is sold at a profit of ${pct}%. Its selling price is`, `SP = CP × (1 + ${pct}/100) = ${rs(cp)} × ${f(1 + pct / 100)} = ${fmtRs(sp)}.`), sp, [cp * (1 - pct / 100), cp + pct, cp * (1 + pct / 10)], "", fmtRs);
  },
  (r) => {
    const cp = r.pick([200, 250, 400, 500, 800, 1000, 1250]), sp = cp + r.pick([-100, -50, 25, 50, 75, 100, 150, 200]);
    if (sp <= 0) return null;
    const pct = ((sp - cp) / cp) * 100;
    return num(r, Q("Easy", "Profit and Loss", "Profit or loss percentage", `A trader buys an item for ${rs(cp)} and sells it for ${rs(sp)}. His ${pct >= 0 ? "profit" : "loss"} percentage is`, `${pct >= 0 ? "Profit" : "Loss"} = ${rs(Math.abs(sp - cp))}; percentage = ${Math.abs(sp - cp)}/${cp} × 100 = ${f(Math.abs(pct))}%.`), Math.abs(pct), [(Math.abs(sp - cp) / sp) * 100, Math.abs(sp - cp), Math.abs(pct) * 2], "", pctFmt);
  },
  (r) => {
    const mark = r.pick([20, 25, 30, 40, 50]), disc = r.pick([10, 12, 15, 20, 25]);
    const pr = ((1 + mark / 100) * (1 - disc / 100) - 1) * 100;
    if (pr <= 0) return null;
    return num(r, Q("Medium", "Profit and Loss", "Marked price and discount", `A shopkeeper marks his goods ${mark}% above the cost price and allows a discount of ${disc}%. His profit percentage is`, `SP = CP × ${f(1 + mark / 100)} × ${f(1 - disc / 100)} = ${f(1 + pr / 100)} CP ⇒ profit ${f(pr)}%.`), pr, [mark - disc, mark, pr + disc / 2], "", pctFmt);
  },
  (r) => {
    const wt = r.pick([800, 900, 950, 960]);
    const g = ((1000 - wt) / wt) * 100;
    return num(r, Q("Hard", "Profit and Loss", "False weights", `A dishonest dealer claims to sell at cost price but uses a weight of ${wt} g instead of 1 kg. His gain percentage is`, `He gives ${wt} g for the price of 1000 g ⇒ gain = ${1000 - wt}/${wt} × 100 = ${f(g)}%.`), g, [((1000 - wt) / 1000) * 100, (1000 - wt) / 10 === g ? g + 1 : (1000 - wt) / 10, g / 2], "", pctFmt);
  },
  (r) => {
    const P = r.pick([1000, 1500, 2000, 2500, 4000, 5000, 6000, 8000, 10000]), R = r.pick([4, 5, 6, 8, 10, 12]), T = r.pick([2, 3, 4, 5]);
    const si = (P * R * T) / 100;
    return num(r, Q("Easy", "Simple and Compound Interest", "Simple interest", `Find the simple interest on ${rs(P)} at ${R}% per annum for ${T} years.`, `SI = PRT/100 = ${P} × ${R} × ${T}/100 = ${fmtRs(si)}.`), si, [P * (1 + R / 100) ** T - P, (P * R) / 100, si + P], "", fmtRs);
  },
  (r) => {
    const P = r.pick([1000, 2000, 4000, 5000, 8000, 10000, 16000]), R = r.pick([5, 10, 20]), T = 2;
    const ci = P * (1 + R / 100) ** T - P;
    return num(r, Q("Medium", "Simple and Compound Interest", "Compound interest", `Find the compound interest on ${rs(P)} at ${R}% per annum for ${T} years, compounded annually.`, `Amount = ${P}(1 + ${R}/100)² = ${fmtRs(P * (1 + R / 100) ** T)}; CI = ${fmtRs(ci)}.`), ci, [(P * R * T) / 100, P * (1 + R / 100) ** T, ci + (P * R) / 100], "", fmtRs);
  },
  (r) => {
    const P = r.pick([2000, 4000, 5000, 8000, 10000, 12500, 20000]), R = r.pick([4, 5, 8, 10, 12]);
    const d = (P * R * R) / 10000;
    return num(r, Q("Hard", "Simple and Compound Interest", "CI – SI difference", `The difference between compound interest and simple interest on ${rs(P)} for 2 years at ${R}% per annum is`, `For 2 years, CI − SI = P(R/100)² = ${P} × (${R}/100)² = ${fmtRs(d)}.`), d, [(P * R) / 100, (P * R * 2) / 100, d * 2], "", fmtRs);
  },
  (r) => {
    const a = r.pick([10, 12, 15, 18, 20, 24, 30]), b = r.pick([12, 15, 20, 24, 30, 36, 40, 60]);
    if (a === b) return null;
    const t = (a * b) / (a + b);
    return num(r, Q("Easy", "Time and Work", "Working together", `A can finish a job in ${a} days and B in ${b} days. Working together, they will finish it in`, `Together per day = 1/${a} + 1/${b} = ${frac(a + b, a * b)} ⇒ time = ${frac(a * b, a + b)} = ${f(t)} days.`), t, [(a + b) / 2, a + b, Math.abs(a - b) || 5], "days");
  },
  (r) => {
    const a = r.pick([10, 12, 15, 20]), b = r.pick([12, 15, 20, 30]), c = r.pick([20, 30, 60]);
    if (new Set([a, b, c]).size < 3) return null;
    const t = 1 / (1 / a + 1 / b + 1 / c);
    return num(r, Q("Medium", "Time and Work", "Three workers", `A, B and C can do a piece of work in ${a}, ${b} and ${c} days respectively. Working together, they finish it in`, `Combined rate = 1/${a} + 1/${b} + 1/${c} ⇒ time = ${f(t)} days.`), t, [(a + b + c) / 3, 1 / (1 / a + 1 / b), t * 2], "days");
  },
  (r) => {
    const a = r.pick([10, 12, 15, 20]), b = r.pick([15, 20, 30]), x = r.int(2, 5);
    if (a === b) return null;
    const rem = 1 - x * (1 / a + 1 / b);
    if (rem <= 0) return null;
    const t = rem * b;
    return num(r, Q("Hard", "Time and Work", "Worker leaves", `A and B can do a work in ${a} and ${b} days respectively. They work together for ${x} days, after which A leaves. In how many more days will B finish the remaining work?`, `Done in ${x} days = ${x}(1/${a} + 1/${b}) = ${f(1 - rem)}; remaining ${f(rem)} by B alone takes ${f(rem)} × ${b} = ${f(t)} days.`), t, [rem * a, b - x, t + x], "days");
  },
  (r) => {
    const fill = r.pick([4, 5, 6, 8, 10, 12]), empty = r.pick([6, 8, 10, 12, 15, 20, 24]);
    if (empty <= fill) return null;
    const t = (fill * empty) / (empty - fill);
    return num(r, Q("Medium", "Pipes and Cisterns", "Inlet and outlet", `A pipe can fill a tank in ${fill} hours and another pipe can empty it in ${empty} hours. If both are opened together, the empty tank fills in`, `Net rate = 1/${fill} − 1/${empty} = ${frac(empty - fill, fill * empty)} ⇒ ${f(t)} hours.`), t, [(fill * empty) / (empty + fill), empty - fill, t / 2], "hours");
  },
  (r) => {
    const x = r.pick([20, 30, 40, 45, 60]), y = r.pick([30, 40, 60, 80, 90]);
    if (x === y) return null;
    const v = (2 * x * y) / (x + y);
    return num(r, Q("Medium", "Time, Speed and Distance", "Average speed", `A car travels from P to Q at ${x} km/h and returns at ${y} km/h. Its average speed for the whole journey is`, `For equal distances, average speed = 2xy/(x + y) = 2 × ${x} × ${y}/${x + y} = ${f(v)} km/h.`), v, [(x + y) / 2, Math.sqrt(x * y), v + 5], "km/h");
  },
  (r) => {
    const L = r.pick([100, 120, 150, 180, 200, 240, 250, 300]), v = r.pick([36, 54, 72, 90, 108]);
    const t = L / ((v * 5) / 18);
    return num(r, Q("Easy", "Time, Speed and Distance", "Train crossing a pole", `A train ${L} m long runs at ${v} km/h. The time it takes to cross a pole is`, `${v} km/h = ${f((v * 5) / 18)} m/s; time = ${L}/${f((v * 5) / 18)} = ${f(t)} s.`), t, [L / v, (L * 18) / (v * 10), t * 2], "s");
  },
  (r) => {
    const L = r.pick([100, 150, 200, 250]), P = r.pick([150, 200, 250, 300, 350]), v = r.pick([36, 54, 72, 90]);
    const t = (L + P) / ((v * 5) / 18);
    return num(r, Q("Medium", "Time, Speed and Distance", "Train crossing a platform", `A ${L} m long train moving at ${v} km/h crosses a ${P} m long platform in`, `Distance = ${L} + ${P} = ${L + P} m; speed = ${f((v * 5) / 18)} m/s; time = ${f(t)} s.`), t, [L / ((v * 5) / 18), P / ((v * 5) / 18), (L + P) / v], "s");
  },
  (r) => {
    const l1 = r.pick([100, 120, 150, 200]), l2 = r.pick([100, 130, 150, 180, 250]), v1 = r.pick([36, 45, 54, 72]), v2 = r.pick([18, 36, 54]);
    const t = (l1 + l2) / (((v1 + v2) * 5) / 18);
    return num(r, Q("Medium", "Time, Speed and Distance", "Trains in opposite directions", `Two trains ${l1} m and ${l2} m long run on parallel tracks in opposite directions at ${v1} km/h and ${v2} km/h. They cross each other in`, `Relative speed = ${v1 + v2} km/h = ${f(((v1 + v2) * 5) / 18)} m/s; time = ${l1 + l2}/${f(((v1 + v2) * 5) / 18)} = ${f(t)} s.`), t, [(l1 + l2) / ((Math.abs(v1 - v2) * 5) / 18 || 1), (l1 + l2) / (v1 + v2), t * 2], "s");
  },
  (r) => {
    const b = r.pick([8, 10, 12, 15, 18, 20]), s = r.pick([2, 3, 4, 5]), d = r.pick([24, 30, 36, 48, 60]);
    const tUp = d / (b - s), tDown = d / (b + s);
    return num(r, Q("Hard", "Boats and Streams", "Round trip", `A boat's speed in still water is ${b} km/h and the stream flows at ${s} km/h. Find the total time for a ${d} km trip upstream and back.`, `Upstream ${d}/${b - s} = ${f(tUp)} h, downstream ${d}/${b + s} = ${f(tDown)} h; total ${f(tUp + tDown)} h.`), tUp + tDown, [(2 * d) / b, tUp, tDown * 2], "hours");
  },
  (r) => {
    const down = r.pick([12, 14, 15, 16, 18, 20, 24]), up = r.pick([6, 8, 9, 10, 12]);
    if (up >= down) return null;
    const b = (down + up) / 2;
    return num(r, Q("Medium", "Boats and Streams", "Speed in still water", `A man rows downstream at ${down} km/h and upstream at ${up} km/h. His speed in still water is`, `Speed in still water = (downstream + upstream)/2 = (${down} + ${up})/2 = ${f(b)} km/h.`), b, [(down - up) / 2, down - up, down + up], "km/h");
  },
  (r) => {
    const xs = Array.from({ length: r.int(5, 7) }, () => r.int(10, 99));
    const avg = xs.reduce((a, x) => a + x, 0) / xs.length;
    return num(r, Q("Easy", "Averages", "Simple average", `The average of ${xs.join(", ")} is`, `Sum = ${xs.reduce((a, x) => a + x, 0)}, count = ${xs.length} ⇒ average ${f(avg)}.`), avg, [avg + 1, xs[Math.floor(xs.length / 2)], avg * 1.1]);
  },
  (r) => {
    const n = r.int(10, 40), a = r.int(30, 60), newAvg = a + r.pick([1, 2, 3, -1, -2]);
    const x = newAvg * (n + 1) - a * n;
    if (x <= 0) return null;
    return num(r, Q("Medium", "Averages", "Change in average", `The average age of ${n} students is ${a} years. When the teacher's age is included, the average becomes ${newAvg} years. The teacher's age is`, `Teacher = ${newAvg} × ${n + 1} − ${a} × ${n} = ${x} years.`), x, [newAvg * (n + 1) - a * (n + 1), x + n, newAvg + n], "years");
  },
  (r) => {
    const n = r.pick([8, 10, 12, 15, 20]), a = r.int(40, 70), wrong = r.int(30, 90), right = r.int(30, 90);
    if (wrong === right) return null;
    const v = a + (right - wrong) / n;
    return num(r, Q("Hard", "Averages", "Correcting an average", `The average of ${n} numbers is ${a}. It was later found that one number was read as ${wrong} instead of ${right}. The correct average is`, `Correct sum = ${n} × ${a} − ${wrong} + ${right} = ${n * a - wrong + right} ⇒ average ${f(v)}.`), v, [a + (wrong - right) / n, a, (n * a + right) / n]);
  },
  (r) => {
    const a = r.int(1, 9), b = r.int(1, 9), total = (a + b) * r.int(10, 200);
    if (a === b) return null;
    const share = (total * a) / (a + b);
    return num(r, Q("Easy", "Ratio and Proportion", "Dividing in a ratio", `${rs(total)} is divided between A and B in the ratio ${a} : ${b}. A's share is`, `A gets ${a}/${a + b} of ${total} = ${fmtRs(share)}.`), share, [(total * b) / (a + b), total / 2, (total * a) / b], "", fmtRs);
  },
  (r) => {
    const a = r.int(2, 7), b = r.int(2, 7), k = r.int(2, 8), y = r.int(4, 10);
    if (a === b) return null;
    // present ages a*k, b*k; after y years ratio?
    const A = a * k, Bq = b * k;
    const g = gcd(A + y, Bq + y);
    return txt(r, Q("Medium", "Problems on Ages", "Ratio of ages", `The present ages of A and B are in the ratio ${a} : ${b}, and A is ${A} years old. What will be the ratio of their ages after ${y} years?`, `B = ${A} × ${b}/${a} = ${Bq}; after ${y} years: ${A + y} : ${Bq + y} = ${(A + y) / g} : ${(Bq + y) / g}.`), `${(A + y) / g} : ${(Bq + y) / g}`, [`${a} : ${b}`, `${(Bq + y) / g} : ${(A + y) / g}`, `${a + y} : ${b + y}`, `${A + y} : ${Bq}`]);
  },
  (r) => {
    const sum = r.pick([40, 50, 60, 70, 80]), diff = r.pick([4, 6, 8, 10, 12, 20]);
    if ((sum + diff) % 2) return null;
    const older = (sum + diff) / 2;
    return num(r, Q("Easy", "Problems on Ages", "Sum and difference", `The sum of the ages of a father and his son is ${sum} years and the difference between their ages is ${diff} years. The father's age is`, `Father = (sum + difference)/2 = (${sum} + ${diff})/2 = ${older} years.`), older, [(sum - diff) / 2, sum - diff, older + 2], "years");
  },
  (r) => {
    const c1 = r.pick([20, 25, 30, 40]), c2 = r.pick([50, 60, 70, 80]), mean = r.pick([35, 40, 45, 50, 55]);
    if (!(c1 < mean && mean < c2)) return null;
    const g = gcd(c2 - mean, mean - c1);
    return txt(r, Q("Hard", "Mixtures and Alligation", "Rule of alligation", `In what ratio must rice at ₹${c1}/kg be mixed with rice at ₹${c2}/kg so that the mixture costs ₹${mean}/kg?`, `Alligation: (${c2} − ${mean}) : (${mean} − ${c1}) = ${c2 - mean} : ${mean - c1} = ${(c2 - mean) / g} : ${(mean - c1) / g}.`), `${(c2 - mean) / g} : ${(mean - c1) / g}`, [`${(mean - c1) / g} : ${(c2 - mean) / g}`, `${c1} : ${c2}`, `1 : 1`, `${c2 - c1} : ${mean}`]);
  },
  (r) => {
    const a = r.pick([12, 18, 24, 30, 36, 40, 45, 48, 60, 72]), b = r.pick([16, 20, 27, 32, 42, 54, 64, 80, 90, 96]);
    const which = r.pick(["HCF", "LCM"]);
    const v = which === "HCF" ? gcd(a, b) : lcm(a, b);
    return num(r, Q("Easy", "Number System", "HCF and LCM", `The ${which} of ${a} and ${b} is`, `${a} and ${b}: HCF = ${gcd(a, b)}, LCM = ${lcm(a, b)}.`), v, [which === "HCF" ? lcm(a, b) : gcd(a, b), a * b, which === "HCF" ? gcd(a, b) * 2 : lcm(a, b) / 2]);
  },
  (r) => {
    const h = r.pick([4, 6, 8, 9, 12, 15]), l = h * r.pick([6, 10, 12, 20, 30]), a = h * r.pick([2, 3, 4, 5]);
    const b = (h * l) / a;
    if (!Number.isInteger(b) || b === a) return null;
    return num(r, Q("Medium", "Number System", "HCF × LCM", `The HCF and LCM of two numbers are ${h} and ${l}. If one number is ${a}, the other is`, `Product of numbers = HCF × LCM ⇒ other = ${h} × ${l}/${a} = ${b}.`), b, [l / a, l / h, (h * l) / (a * 2)]);
  },
  (r) => {
    const base = r.int(2, 9), n = r.int(10, 99);
    const d = Number(BigInt(base) ** BigInt(n) % 10n);
    return num(r, Q("Medium", "Number System", "Unit digit", `The unit digit of ${m(`${base}^{${n}}`)} is`, `Unit digits of powers of ${base} repeat with period ${[0, 1, 4, 4, 2, 1, 1, 4, 4, 2][base]}; ${n} mod that period gives unit digit ${d}.`), d, [(d + 2) % 10, (d + 4) % 10, base]);
  },
  (r) => {
    const lo = r.int(1, 50), hi = lo + r.int(100, 400), d = r.pick([3, 6, 7, 9, 11, 13]);
    const cnt = Math.floor(hi / d) - Math.floor((lo - 1) / d);
    return num(r, Q("Easy", "Number System", "Counting multiples", `How many numbers between ${lo} and ${hi} (both inclusive) are divisible by ${d}?`, `⌊${hi}/${d}⌋ − ⌊${lo - 1}/${d}⌋ = ${Math.floor(hi / d)} − ${Math.floor((lo - 1) / d)} = ${cnt}.`), cnt, [cnt + 1, cnt - 1, Math.floor((hi - lo) / d)]);
  },
  (r) => {
    const a = r.int(3, 9) * 1000, b = r.int(3, 9) * 1000, ta = r.pick([12, 6, 8, 10]), tb = 12, profit = r.int(5, 30) * 1000;
    const wa = a * ta, wb = b * tb, share = (profit * wa) / (wa + wb);
    return num(r, Q("Medium", "Partnership", "Profit sharing", `A invests ${rs(a)} for ${ta} months and B invests ${rs(b)} for ${tb} months in a business. Out of a total profit of ${rs(profit)}, A's share is`, `Ratio = ${a} × ${ta} : ${b} × ${tb} = ${wa / gcd(wa, wb)} : ${wb / gcd(wa, wb)} ⇒ A gets ${fmtRs(share)}.`), share, [(profit * a) / (a + b), (profit * wb) / (wa + wb), profit / 2], "", fmtRs);
  },
  (r) => {
    const items = [
      ["getting a head when a fair coin is tossed", 1, 2], ["getting an even number on a fair die", 1, 2], ["getting a number greater than 4 on a fair die", 1, 3], ["drawing a king from a standard deck of 52 cards", 1, 13],
      ["drawing a heart from a standard deck of 52 cards", 1, 4], ["drawing a red face card from a standard deck of 52 cards", 3, 26], ["getting two heads when two fair coins are tossed", 1, 4], ["getting a sum of 7 with two fair dice", 1, 6],
      ["getting a doublet with two fair dice", 1, 6], ["getting at least one head when three fair coins are tossed", 7, 8], ["drawing an ace or a king from a standard deck of 52 cards", 2, 13], ["getting a prime number on a fair die", 1, 2],
    ] as const;
    const [e, n, d] = r.pick(items);
    return num(r, Q(d >= 8 && n > 1 ? "Medium" : "Easy", "Probability", "Basic probability", `The probability of ${e} is`, `Favourable outcomes / total outcomes = ${frac(n, d)}.`), n / d, [1 - n / d === n / d ? 1 / 3 : 1 - n / d, 1 / (d + 1), n / (2 * d)], "", ratio);
  },
  (r) => {
    const n = r.int(4, 7), k = r.int(2, 3);
    const which = r.pick(["arrange", "choose"]);
    const v = which === "arrange" ? fact(n) / fact(n - k) : C(n, k);
    return num(r, Q("Medium", "Permutations and Combinations", which === "arrange" ? "Arrangements" : "Selections", which === "arrange" ? `In how many ways can ${k} students be chosen from ${n} and seated in a row of ${k} chairs?` : `In how many ways can a team of ${k} be selected from ${n} players?`, which === "arrange" ? `${m(`{}^{${n}}P_{${k}} = ${v}`)}.` : `${m(`{}^{${n}}C_{${k}} = ${v}`)}.`), v, [which === "arrange" ? C(n, k) : fact(n) / fact(n - k), n * k, fact(n)]);
  },
  (r) => {
    const l = r.int(5, 20), b = r.int(3, 15);
    const which = r.pick(["area", "perimeter", "diagonal"]);
    const d2 = l * l + b * b;
    if (which === "diagonal" && !Number.isInteger(Math.sqrt(d2))) return null;
    const v = which === "area" ? l * b : which === "perimeter" ? 2 * (l + b) : Math.sqrt(d2);
    return num(r, Q("Easy", "Mensuration", "Rectangle", `A rectangle measures ${l} m by ${b} m. Its ${which} is`, which === "area" ? `Area = ${l} × ${b} = ${v} m².` : which === "perimeter" ? `Perimeter = 2(${l} + ${b}) = ${v} m.` : `Diagonal = √(${l}² + ${b}²) = ${v} m.`), v, which === "area" ? [2 * (l + b), l * b * 2, l + b] : which === "perimeter" ? [l * b, l + b, 4 * (l + b)] : [l + b, d2, l * b / 2], which === "area" ? "m²" : "m");
  },
  (r) => {
    const rad = r.pick([7, 14, 21, 3.5, 10.5, 28]);
    const which = r.pick(["area", "circumference"]);
    const v = which === "area" ? (22 / 7) * rad * rad : 2 * (22 / 7) * rad;
    return num(r, Q("Easy", "Mensuration", "Circle", `The ${which} of a circle of radius ${rad} cm is (take ${m("\\pi = 22/7")})`, which === "area" ? `πr² = 22/7 × ${rad}² = ${f(v)} cm².` : `2πr = 2 × 22/7 × ${rad} = ${f(v)} cm.`), v, which === "area" ? [2 * (22 / 7) * rad, (22 / 7) * rad, v * 2] : [(22 / 7) * rad * rad, (22 / 7) * rad, v * 2], which === "area" ? "cm²" : "cm");
  },
  (r) => {
    const a = r.int(2, 9), b = r.int(1, 9), c = r.int(1, 9), x = r.int(2, 12);
    const rhs = a * x + b;
    return num(r, Q("Easy", "Simplification", "Linear equation", `If ${a}x + ${b} = ${rhs}, then x equals`, `${a}x = ${rhs} − ${b} = ${rhs - b} ⇒ x = ${x}.`), x, [x + 1, (rhs + b) / a, rhs / a === x ? x + c : rhs / a]);
  },
];

// =========================================================================== Logical Reasoning
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const WORDS = ["CAT", "DOG", "BOOK", "TREE", "FISH", "MILK", "LAMP", "DESK", "BIRD", "PEN", "CODE", "GAME", "STAR", "MOON", "RAIN", "SHIP", "KING", "ROSE", "GOLD", "WIND", "TIGER", "PLANT", "WATER", "CLOUD", "HOUSE", "TRAIN", "BREAD", "CHAIR", "MANGO", "LIGHT"];
const shiftWord = (w: string, k: number) => [...w].map((c) => LETTERS[(LETTERS.indexOf(c) + k + 26) % 26]).join("");

// Relation chains: [statement template, answer] with placeholders A, B, C (gender fixed by the wording).
const RELATIONS: [string, string, Difficulty][] = [
  ["A is the son of B. B is the daughter of C. How is A related to C?", "Grandson", "Easy"],
  ["A is the daughter of B. B is the son of C. How is A related to C?", "Granddaughter", "Easy"],
  ["A is the brother of B. B is the father of C. How is A related to C?", "Uncle", "Easy"],
  ["A is the sister of B. B is the mother of C. How is A related to C?", "Aunt", "Easy"],
  ["A is the son of B. B is the brother of C. How is A related to C?", "Nephew", "Easy"],
  ["A is the daughter of B. B is the sister of C. How is A related to C?", "Niece", "Easy"],
  ["A is the wife of B. B is the son of C. How is A related to C?", "Daughter-in-law", "Medium"],
  ["A is the husband of B. B is the daughter of C. How is A related to C?", "Son-in-law", "Medium"],
  ["A is the father of B. B is the father of C. How is A related to C?", "Grandfather", "Easy"],
  ["A is the mother of B. B is the mother of C. How is A related to C?", "Grandmother", "Easy"],
  ["A is the brother of B. B is the wife of C. How is A related to C?", "Brother-in-law", "Medium"],
  ["A is the sister of B. B is the husband of C. How is A related to C?", "Sister-in-law", "Medium"],
  ["A is the son of B. B is the wife of C. How is A related to C?", "Son", "Easy"],
  ["A is the mother of B. B is the wife of C. How is A related to C?", "Mother-in-law", "Medium"],
  ["A is the father of B. B is the husband of C. How is A related to C?", "Father-in-law", "Medium"],
  ["A is the son of B. B is the sister of C. C is the father of D. How is A related to D?", "Cousin", "Hard"],
  ["A is the daughter of B. B is the son of C. C is the wife of D. How is A related to D?", "Granddaughter", "Hard"],
  ["A is the brother of B. B is the daughter of C. C is the husband of D. How is A related to D?", "Son", "Hard"],
  ["A is the wife of B. B is the brother of C. C is the father of D. How is A related to D?", "Aunt", "Hard"],
  ["A is the son of B. B is the son of C. C is the brother of D. How is A related to D?", "Grand-nephew", "Hard"],
  ["A is the mother of B. B is the brother of C. C is the husband of D. How is A related to D?", "Mother-in-law", "Hard"],
];
const RELATION_POOL = [...new Set(RELATIONS.map(([, a]) => a)), "Father", "Mother", "Brother", "Sister", "Daughter"];
const NAMES = ["P", "Q", "R", "S", "T", "M", "N", "X", "Y", "Z", "K", "L"];

const DIRS = ["North", "East", "South", "West"];

const SYLLOGISMS: [string, string, Difficulty][] = [
  ["All roses are flowers. All flowers are plants. Conclusion: All roses are plants.", "Follows", "Easy"],
  ["All pens are tools. Some tools are costly. Conclusion: Some pens are costly.", "Does not follow", "Medium"],
  ["No cat is a dog. All dogs are animals. Conclusion: No cat is an animal.", "Does not follow", "Medium"],
  ["Some books are novels. All novels are stories. Conclusion: Some books are stories.", "Follows", "Easy"],
  ["All doctors are graduates. No graduate is illiterate. Conclusion: No doctor is illiterate.", "Follows", "Medium"],
  ["Some boys are players. Some players are singers. Conclusion: Some boys are singers.", "Does not follow", "Medium"],
  ["All squares are rectangles. All rectangles are quadrilaterals. Conclusion: All quadrilaterals are squares.", "Does not follow", "Easy"],
  ["No metal is a liquid. Some liquids are fuels. Conclusion: Some fuels are not metals.", "Follows", "Hard"],
  ["All birds have wings. Some animals are birds. Conclusion: Some animals have wings.", "Follows", "Easy"],
  ["Some apples are red. All red things are bright. Conclusion: All apples are bright.", "Does not follow", "Medium"],
  ["All engineers are logical. Some logical people are artists. Conclusion: Some engineers are artists.", "Does not follow", "Hard"],
  ["No fruit is a vegetable. All carrots are vegetables. Conclusion: No carrot is a fruit.", "Follows", "Medium"],
  ["All mobiles are gadgets. No gadget is cheap. Conclusion: Some mobiles are cheap.", "Does not follow", "Medium"],
  ["Some teachers are writers. All writers are readers. Conclusion: Some teachers are readers.", "Follows", "Easy"],
  ["All lions are cats. No cat is a herbivore. Conclusion: No lion is a herbivore.", "Follows", "Hard"],
  ["Some cars are red. No red thing is cheap. Conclusion: Some cars are not cheap.", "Follows", "Hard"],
  ["All coins are metals. Some metals are rare. Conclusion: All coins are rare.", "Does not follow", "Easy"],
  ["No student is lazy. Some lazy people are rich. Conclusion: Some rich people are not students.", "Follows", "Hard"],
];

export const logicalReasoning: Template[] = [
  (r) => {
    const a = r.int(2, 30), d = r.int(2, 12), n = 5;
    const s = Array.from({ length: n + 1 }, (_, i) => a + i * d);
    return num(r, Q("Easy", "Number Series", "Arithmetic series", `Find the next number in the series: ${s.slice(0, n).join(", ")}, ?`, `Each term increases by ${d}: ${s[n - 1]} + ${d} = ${s[n]}.`), s[n], [s[n] + d, s[n] - 1, s[n] + 1]);
  },
  (r) => {
    const a = r.int(1, 5), k = r.pick([2, 3]), n = 5;
    const s = Array.from({ length: n + 1 }, (_, i) => a * k ** i);
    return num(r, Q("Easy", "Number Series", "Geometric series", `Find the next number: ${s.slice(0, n).join(", ")}, ?`, `Each term is multiplied by ${k}: ${s[n - 1]} × ${k} = ${s[n]}.`), s[n], [s[n] + s[n - 1], s[n] - k, s[n - 1] * (k + 1)]);
  },
  (r) => {
    const a = r.int(1, 20), d0 = r.int(1, 5), dd = r.int(1, 4), n = 6;
    const s = [a];
    for (let i = 1; i <= n; i++) s.push(s[i - 1] + d0 + (i - 1) * dd);
    return num(r, Q("Medium", "Number Series", "Second differences", `Find the next number: ${s.slice(0, n).join(", ")}, ?`, `Differences ${s.slice(1, n).map((x, i) => x - s[i]).join(", ")} increase by ${dd}; next difference ${s[n] - s[n - 1]} ⇒ ${s[n]}.`), s[n], [s[n] - dd, s[n] + dd, s[n - 1] + (s[n - 1] - s[n - 2])]);
  },
  (r) => {
    const off = r.int(-3, 5), start = r.int(1, 5), sq = r.pick([2, 3]);
    const s = Array.from({ length: 6 }, (_, i) => (start + i) ** sq + off);
    return num(r, Q("Medium", "Number Series", sq === 2 ? "Squares" : "Cubes", `Find the next number: ${s.slice(0, 5).join(", ")}, ?`, `Terms are n${sq === 2 ? "²" : "³"} ${off >= 0 ? "+" : "−"} ${Math.abs(off)} for n = ${start}, ${start + 1}, … ⇒ ${(start + 5) ** sq} ${off >= 0 ? "+" : "−"} ${Math.abs(off)} = ${s[5]}.`), s[5], [s[5] + 1, (start + 5) ** sq, s[4] + (s[4] - s[3])]);
  },
  (r) => {
    const a = r.int(1, 9), b = r.int(20, 40), da = r.int(2, 5), db = -r.int(1, 4);
    const s: number[] = [];
    for (let i = 0; i < 7; i++) s.push(i % 2 === 0 ? a + (i / 2) * da : b + ((i - 1) / 2) * db);
    return num(r, Q("Hard", "Number Series", "Alternating series", `Find the next number: ${s.slice(0, 6).join(", ")}, ?`, `Two interleaved series: ${a}, ${a + da}, … (+${da}) and ${b}, ${b + db}, … (${db}). The 7th term belongs to the first ⇒ ${s[6]}.`), s[6], [s[5] + db, s[4] + 2 * da + 1, s[6] + da]);
  },
  (r) => {
    const start = r.int(0, 10), k = r.int(2, 4);
    const s = Array.from({ length: 6 }, (_, i) => LETTERS[(start + i * k) % 26]);
    return txt(r, Q("Easy", "Letter Series", "Skipping letters", `Find the next letter: ${s.slice(0, 5).join(", ")}, ?`, `Each letter moves ${k} places forward ⇒ ${s[5]}.`), s[5], [LETTERS[(start + 5 * k + 1) % 26], LETTERS[(start + 5 * k - 1 + 26) % 26], LETTERS[(start + 4 * k + 2) % 26], LETTERS[(start + 5 * k + 2) % 26]]);
  },
  (r) => {
    const [w, t] = r.sample(WORDS, 2), k = r.pick([1, 2, 3, -1, -2]);
    return txt(r, Q("Easy", "Coding-Decoding", "Letter shift", `If ${w} is written as ${shiftWord(w, k)} in a certain code, how is ${t} written in that code?`, `Each letter is shifted ${Math.abs(k)} place(s) ${k > 0 ? "forward" : "backward"} ⇒ ${t} → ${shiftWord(t, k)}.`), shiftWord(t, k), [shiftWord(t, -k), shiftWord(t, k + 1), shiftWord(t, k).split("").reverse().join(""), shiftWord(t, k - 1 || 2)]);
  },
  (r) => {
    const [w, t] = r.sample(WORDS, 2), k = r.pick([1, 2]);
    const enc = (s: string) => shiftWord(s, k).split("").reverse().join("");
    return txt(r, Q("Hard", "Coding-Decoding", "Shift and reverse", `In a code, ${w} is written as ${enc(w)}. How is ${t} written in that code?`, `Shift each letter ${k} forward and reverse the word: ${t} → ${shiftWord(t, k)} → ${enc(t)}.`), enc(t), [shiftWord(t, k), t.split("").reverse().join(""), shiftWord(t, -k).split("").reverse().join(""), enc(t).split("").reverse().join("") === enc(t) ? shiftWord(t, k + 1) : enc(t).split("").reverse().join("")]);
  },
  (r) => {
    const [w, t] = r.sample(WORDS.filter((x) => x.length <= 5), 2);
    const val = (s: string) => [...s].reduce((a, c) => a + LETTERS.indexOf(c) + 1, 0);
    return num(r, Q("Medium", "Coding-Decoding", "Letter values", `If A = 1, B = 2, …, Z = 26 and ${w} = ${val(w)}, then ${t} = ?`, `The code is the sum of letter positions: ${[...t].map((c) => LETTERS.indexOf(c) + 1).join(" + ")} = ${val(t)}.`), val(t), [val(t) + 1, val(t) - 2, val(t) + t.length]);
  },
  (r) => {
    const [stmt, ans, diff] = r.pick(RELATIONS);
    const names = r.sample(NAMES, 4);
    const q = stmt.replace(/\bA\b/g, names[0]).replace(/\bB\b/g, names[1]).replace(/\bC\b/g, names[2]).replace(/\bD\b/g, names[3]);
    return txt(r, Q(diff, "Blood Relations", "Relation chains", q, `Follow the chain step by step from ${names[0]}: the relation is ${ans.toLowerCase()}.`), ans, RELATION_POOL);
  },
  (r) => {
    // random right-angle walk, answer straight-line distance (Pythagorean triple) and direction
    const legs = r.int(2, 4);
    let x = 0, y = 0, dir = r.int(0, 3);
    const steps: string[] = [];
    for (let i = 0; i < legs; i++) {
      const d = r.pick([2, 3, 4, 5, 6, 8, 10, 12]);
      if (i > 0) {
        const turn = r.pick(["right", "left"]);
        dir = (dir + (turn === "right" ? 1 : 3)) % 4;
        steps.push(`turns ${turn} and walks ${d} km`);
      } else steps.push(`walks ${d} km ${DIRS[dir]}`);
      x += [0, 1, 0, -1][dir] * d;
      y += [1, 0, -1, 0][dir] * d;
    }
    const dist = Math.sqrt(x * x + y * y);
    if (!dist || !Number.isInteger(dist)) return null;
    return num(r, Q(legs > 2 ? "Medium" : "Easy", "Direction Sense", "Distance from start", `A man ${steps.join(", then ")}. How far is he from his starting point?`, `Net displacement: ${Math.abs(x)} km ${x >= 0 ? "East" : "West"} and ${Math.abs(y)} km ${y >= 0 ? "North" : "South"} ⇒ distance √(${x * x} + ${y * y}) = ${dist} km.`), dist, [Math.abs(x) + Math.abs(y), dist + 2, Math.abs(Math.abs(x) - Math.abs(y)) || dist + 4], "km");
  },
  (r) => {
    const start = r.int(0, 3), turns = Array.from({ length: r.int(2, 4) }, () => r.pick(["right", "left", "back"] as const));
    let dir = start;
    for (const t of turns) dir = (dir + (t === "right" ? 1 : t === "left" ? 3 : 2)) % 4;
    return txt(r, Q(turns.length > 3 ? "Hard" : "Medium", "Direction Sense", "Facing direction", `A person is facing ${DIRS[start]}. He turns ${turns.map((t) => (t === "back" ? "about (180°)" : `90° ${t}`)).join(", then ")}. Which direction is he facing now?`, `Apply each turn in order starting from ${DIRS[start]}: final direction ${DIRS[dir]}.`), DIRS[dir], DIRS);
  },
  (r) => {
    const h = r.int(1, 12), mm = r.pick([0, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
    let ang = Math.abs(30 * (h % 12) - 5.5 * mm);
    if (ang > 180) ang = 360 - ang;
    return num(r, Q(mm % 30 ? "Hard" : "Medium", "Clocks", "Angle between hands", `The angle between the hour and minute hands of a clock at ${h}:${String(mm).padStart(2, "0")} is`, `θ = |30H − 5.5M| = |${30 * (h % 12)} − ${5.5 * mm}| = ${f(Math.abs(30 * (h % 12) - 5.5 * mm))}°; take the smaller angle ⇒ ${f(ang)}°.`), ang, [Math.abs(30 * (h % 12) - 6 * mm) % 360 || 15, 360 - ang === ang ? ang + 30 : 360 - ang, ang + 15], "", deg);
  },
  (r) => {
    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const d0 = r.int(0, 6), n = r.int(10, 400);
    return txt(r, Q(n > 100 ? "Medium" : "Easy", "Calendar", "Day after n days", `If today is ${days[d0]}, what day of the week will it be after ${n} days?`, `${n} = 7 × ${Math.floor(n / 7)} + ${n % 7} ⇒ ${n % 7} day(s) after ${days[d0]} is ${days[(d0 + n) % 7]}.`), days[(d0 + n) % 7], days);
  },
  (r) => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const y = r.int(1990, 2030), mo = r.int(0, 11), d = r.int(1, 28);
    const dt = new Date(Date.UTC(y, mo, d));
    const monthName = dt.toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
    return txt(r, Q("Hard", "Calendar", "Day of a given date", `What day of the week was (or will be) ${d} ${monthName} ${y}?`, `Count odd days from a known reference (1 January 1900 was a Monday) ⇒ ${days[dt.getUTCDay()]}.`), days[dt.getUTCDay()], days);
  },
  (r) => {
    const left = r.int(5, 30), right = r.int(5, 30);
    const total = left + right - 1;
    return num(r, Q("Easy", "Ranking and Order", "Position from both ends", `In a row of students, Rahul is ${ord(left)} from the left and ${ord(right)} from the right. How many students are in the row?`, `Total = ${left} + ${right} − 1 = ${total}.`), total, [left + right, total - 1, left + right + 1]);
  },
  (r) => {
    const total = r.int(30, 60), top = r.int(5, 25);
    const bottom = total - top + 1;
    return num(r, Q("Easy", "Ranking and Order", "Rank from the other end", `In a class of ${total} students, Priya ranks ${ord(top)} from the top. What is her rank from the bottom?`, `Rank from bottom = ${total} − ${top} + 1 = ${bottom}.`), bottom, [total - top, bottom + 1, total - top - 1]);
  },
  (r) => {
    const sets: [number[], number, string][] = [
      [[2, 3, 5, 7, 9, 11], 9, "9 is the only composite number; the rest are prime"],
      [[4, 9, 16, 20, 25, 36], 20, "20 is not a perfect square"],
      [[8, 27, 64, 100, 125], 100, "100 is not a perfect cube"],
      [[3, 6, 9, 14, 15, 21], 14, "14 is not a multiple of 3"],
      [[11, 13, 17, 19, 21, 23], 21, "21 = 3 × 7 is not prime"],
      [[121, 144, 169, 180, 196], 180, "180 is not a perfect square"],
      [[2, 4, 8, 16, 24, 32], 24, "24 is not a power of 2"],
    ];
    const [xs, odd, why] = r.pick(sets);
    return num(r, Q("Easy", "Classification", "Odd one out", `Find the odd one out: ${r.shuffle([...xs]).join(", ")}`, `${why}.`), odd, xs.filter((x) => x !== odd).slice(0, 3));
  },
  (r) => {
    const fns: [string, (x: number) => number][] = [["x²", (x) => x * x], ["x³", (x) => x ** 3], ["x² + 1", (x) => x * x + 1], ["2x + 3", (x) => 2 * x + 3], ["x(x + 1)", (x) => x * (x + 1)]];
    const [desc, fn] = r.pick(fns);
    const a = r.int(2, 9), b = r.int(2, 12);
    if (a === b) return null;
    return num(r, Q("Medium", "Analogy", "Number analogy", `Find the missing number: ${a} : ${fn(a)} :: ${b} : ?`, `The rule is ${desc}: ${b} → ${fn(b)}.`), fn(b), [fn(b) + 1, fn(b) - b, fn(a) + b]);
  },
  (r) => {
    const [s, ans, diff] = r.pick(SYLLOGISMS);
    return txt(r, Q(diff, "Syllogisms", "Two premises", `${s} Does the conclusion follow from the statements?`, ans === "Follows" ? "The conclusion is forced by the premises (draw the Venn diagram)." : "A Venn diagram can satisfy both premises without the conclusion, so it does not necessarily follow."), ans, ["Follows", "Does not follow", "Follows only if the first statement is reversed", "Cannot be checked without more data"]);
  },
  (r) => {
    const total = r.int(40, 100), a = r.int(15, 40), b = r.int(15, 40), both = r.int(3, 14);
    const neither = total - (a + b - both);
    if (neither < 0 || both > Math.min(a, b)) return null;
    return num(r, Q("Medium", "Venn Diagrams", "Neither set", `In a group of ${total} people, ${a} like tea, ${b} like coffee and ${both} like both. How many like neither?`, `At least one = ${a} + ${b} − ${both} = ${a + b - both}; neither = ${total} − ${a + b - both} = ${neither}.`), neither, [total - a - b, neither + both, total - (a + b)  + 2 * both]);
  },
  (r) => {
    const n = r.int(5, 26);
    const fromRight = 27 - n;
    return txt(r, Q("Easy", "Alphabet Test", "Position of a letter", `In the English alphabet, which letter is ${ord(fromRight)} from the right end?`, `${ord(fromRight)} from the right = (27 − ${fromRight}) = ${ord(n)} from the left = ${LETTERS[n - 1]}.`), LETTERS[n - 1], [LETTERS[fromRight - 1], LETTERS[n % 26], LETTERS[(n + 24) % 26]]);
  },
];

// =========================================================================== Verbal Ability
const SYNONYMS: [string, string, string[], Difficulty][] = [
  ["Abundant", "Plentiful", ["Scarce", "Rare", "Empty"], "Easy"], ["Brief", "Short", ["Long", "Tall", "Slow"], "Easy"], ["Candid", "Frank", ["Secretive", "Rude", "Shy"], "Medium"],
  ["Diligent", "Hard-working", ["Lazy", "Careless", "Clever"], "Easy"], ["Eminent", "Distinguished", ["Unknown", "Imminent", "Ordinary"], "Medium"], ["Frugal", "Thrifty", ["Wasteful", "Generous", "Poor"], "Medium"],
  ["Gregarious", "Sociable", ["Shy", "Angry", "Greedy"], "Hard"], ["Hostile", "Unfriendly", ["Kind", "Welcoming", "Calm"], "Easy"], ["Inevitable", "Unavoidable", ["Uncertain", "Unlikely", "Optional"], "Medium"],
  ["Jubilant", "Joyful", ["Sad", "Tired", "Jealous"], "Medium"], ["Lucid", "Clear", ["Vague", "Bright", "Lazy"], "Medium"], ["Meticulous", "Careful", ["Careless", "Quick", "Rough"], "Medium"],
  ["Novice", "Beginner", ["Expert", "Teacher", "Leader"], "Easy"], ["Obsolete", "Outdated", ["Modern", "Popular", "Useful"], "Medium"], ["Prudent", "Wise", ["Foolish", "Proud", "Rash"], "Medium"],
  ["Reluctant", "Unwilling", ["Eager", "Ready", "Happy"], "Easy"], ["Tranquil", "Calm", ["Noisy", "Busy", "Angry"], "Easy"], ["Ubiquitous", "Omnipresent", ["Rare", "Unique", "Hidden"], "Hard"],
  ["Vivid", "Bright", ["Dull", "Faint", "Pale"], "Easy"], ["Zealous", "Enthusiastic", ["Indifferent", "Jealous", "Lazy"], "Hard"], ["Ambiguous", "Unclear", ["Obvious", "Definite", "Simple"], "Medium"],
  ["Benevolent", "Kind", ["Cruel", "Selfish", "Harsh"], "Medium"], ["Cogent", "Convincing", ["Weak", "Confusing", "Irrelevant"], "Hard"], ["Deference", "Respect", ["Contempt", "Difference", "Defiance"], "Hard"],
  ["Ephemeral", "Short-lived", ["Eternal", "Lasting", "Ancient"], "Hard"], ["Fortitude", "Courage", ["Cowardice", "Fortune", "Weakness"], "Hard"], ["Garrulous", "Talkative", ["Silent", "Reserved", "Shy"], "Hard"],
  ["Lethargic", "Sluggish", ["Energetic", "Active", "Alert"], "Medium"], ["Mitigate", "Lessen", ["Worsen", "Increase", "Ignore"], "Hard"], ["Opulent", "Wealthy", ["Poor", "Plain", "Humble"], "Hard"],
  ["Placid", "Peaceful", ["Agitated", "Violent", "Noisy"], "Medium"], ["Robust", "Strong", ["Weak", "Fragile", "Thin"], "Easy"], ["Scrutinise", "Examine", ["Ignore", "Overlook", "Skim"], "Medium"],
  ["Tenacious", "Persistent", ["Weak", "Yielding", "Lazy"], "Hard"], ["Vindicate", "Justify", ["Accuse", "Blame", "Condemn"], "Hard"], ["Astute", "Shrewd", ["Naive", "Foolish", "Slow"], "Hard"],
];
const ANTONYMS: [string, string, string[], Difficulty][] = [
  ["Ancient", "Modern", ["Old", "Antique", "Historic"], "Easy"], ["Brave", "Cowardly", ["Bold", "Fearless", "Daring"], "Easy"], ["Expand", "Contract", ["Enlarge", "Extend", "Grow"], "Easy"],
  ["Generous", "Stingy", ["Kind", "Liberal", "Charitable"], "Easy"], ["Humble", "Arrogant", ["Modest", "Meek", "Simple"], "Easy"], ["Increase", "Decrease", ["Raise", "Grow", "Expand"], "Easy"],
  ["Optimist", "Pessimist", ["Idealist", "Realist", "Dreamer"], "Medium"], ["Permanent", "Temporary", ["Lasting", "Stable", "Fixed"], "Easy"], ["Scarcity", "Abundance", ["Shortage", "Lack", "Need"], "Medium"],
  ["Transparent", "Opaque", ["Clear", "Lucid", "Visible"], "Medium"], ["Victory", "Defeat", ["Triumph", "Win", "Success"], "Easy"], ["Artificial", "Natural", ["Fake", "Synthetic", "Man-made"], "Easy"],
  ["Accept", "Reject", ["Receive", "Admit", "Approve"], "Easy"], ["Benign", "Malignant", ["Gentle", "Harmless", "Mild"], "Hard"], ["Conceal", "Reveal", ["Hide", "Cover", "Mask"], "Medium"],
  ["Diminish", "Augment", ["Reduce", "Lessen", "Shrink"], "Hard"], ["Frivolous", "Serious", ["Silly", "Trivial", "Playful"], "Hard"], ["Hinder", "Facilitate", ["Obstruct", "Block", "Delay"], "Hard"],
  ["Lenient", "Strict", ["Mild", "Soft", "Tolerant"], "Medium"], ["Prosperity", "Adversity", ["Wealth", "Success", "Fortune"], "Medium"], ["Rigid", "Flexible", ["Stiff", "Firm", "Hard"], "Easy"],
  ["Superficial", "Profound", ["Shallow", "Surface", "Slight"], "Hard"], ["Verbose", "Concise", ["Wordy", "Lengthy", "Rambling"], "Hard"], ["Zenith", "Nadir", ["Peak", "Summit", "Top"], "Hard"],
  ["Admire", "Despise", ["Respect", "Praise", "Value"], "Medium"], ["Compulsory", "Optional", ["Mandatory", "Required", "Necessary"], "Easy"], ["Feeble", "Strong", ["Weak", "Frail", "Faint"], "Easy"],
  ["Gloomy", "Cheerful", ["Dark", "Sad", "Dull"], "Easy"], ["Obscure", "Famous", ["Unknown", "Hidden", "Vague"], "Medium"], ["Vertical", "Horizontal", ["Upright", "Erect", "Standing"], "Easy"],
];
const ONE_WORD: [string, string, string[], Difficulty][] = [
  ["A person who does not believe in the existence of God", "Atheist", ["Theist", "Agnostic", "Pagan"], "Medium"], ["A place where bees are kept", "Apiary", ["Aviary", "Aquarium", "Granary"], "Medium"],
  ["A person who can speak many languages", "Polyglot", ["Linguist", "Bilingual", "Orator"], "Medium"], ["Life history of a person written by someone else", "Biography", ["Autobiography", "Memoir", "Diary"], "Easy"],
  ["A person who walks on foot", "Pedestrian", ["Commuter", "Passenger", "Traveller"], "Easy"], ["Fear of heights", "Acrophobia", ["Claustrophobia", "Hydrophobia", "Agoraphobia"], "Hard"],
  ["One who looks at the bright side of things", "Optimist", ["Pessimist", "Realist", "Cynic"], "Easy"], ["A government by the people", "Democracy", ["Monarchy", "Autocracy", "Oligarchy"], "Easy"],
  ["A word that is opposite in meaning to another", "Antonym", ["Synonym", "Homonym", "Acronym"], "Easy"], ["Animals that eat only plants", "Herbivores", ["Carnivores", "Omnivores", "Insectivores"], "Easy"],
  ["A list of books used in preparing a work", "Bibliography", ["Biography", "Glossary", "Index"], "Medium"], ["A person who is a habitual drinker", "Drunkard", ["Teetotaller", "Glutton", "Gourmet"], "Easy"],
  ["One who abstains completely from alcohol", "Teetotaller", ["Drunkard", "Vegetarian", "Ascetic"], "Medium"], ["A speech made without preparation", "Extempore", ["Monologue", "Soliloquy", "Rehearsal"], "Medium"],
  ["That which cannot be read", "Illegible", ["Eligible", "Inaudible", "Invisible"], "Medium"], ["A person who loves mankind", "Philanthropist", ["Misanthrope", "Philatelist", "Misogynist"], "Hard"],
  ["One who collects stamps", "Philatelist", ["Numismatist", "Philanthropist", "Lexicographer"], "Hard"], ["A study of ancient things", "Archaeology", ["Anthropology", "Astrology", "Geology"], "Medium"],
  ["Murder of one's own father", "Patricide", ["Matricide", "Fratricide", "Regicide"], "Hard"], ["A medicine that counters a poison", "Antidote", ["Antibiotic", "Anaesthetic", "Antiseptic"], "Medium"],
  ["Something that cannot be avoided", "Inevitable", ["Invincible", "Infallible", "Incredible"], "Medium"], ["A person who settles disputes between two parties", "Arbitrator", ["Advocate", "Witness", "Jury"], "Hard"],
  ["A room where clothes are kept", "Wardrobe", ["Pantry", "Cellar", "Attic"], "Easy"], ["One who is new to a profession", "Novice", ["Veteran", "Expert", "Mentor"], "Easy"],
];
const IDIOMS: [string, string, string[], Difficulty][] = [
  ["Break the ice", "To start a conversation in an awkward situation", ["To damage something", "To feel very cold", "To end a friendship"], "Easy"],
  ["Once in a blue moon", "Very rarely", ["Every night", "During a full moon", "Very often"], "Easy"],
  ["A piece of cake", "Something very easy", ["A small reward", "A sweet dish", "A difficult task"], "Easy"],
  ["Hit the nail on the head", "To describe exactly what is causing a problem", ["To hurt oneself", "To work as a carpenter", "To make a mistake"], "Medium"],
  ["Burn the midnight oil", "To work or study late into the night", ["To waste fuel", "To start a fire", "To sleep early"], "Easy"],
  ["Spill the beans", "To reveal a secret", ["To waste food", "To cook carelessly", "To make a mess"], "Easy"],
  ["Bite the bullet", "To face a difficult situation bravely", ["To get injured", "To eat quickly", "To lose a fight"], "Medium"],
  ["Under the weather", "Feeling ill", ["Feeling cold", "Being outdoors", "Being very happy"], "Easy"],
  ["Cost an arm and a leg", "To be very expensive", ["To cause an injury", "To be cheap", "To need hard work"], "Easy"],
  ["Let the cat out of the bag", "To reveal a secret by mistake", ["To free an animal", "To go shopping", "To create confusion"], "Medium"],
  ["Beat around the bush", "To avoid talking about the main point", ["To search a garden", "To defeat someone easily", "To clean bushes"], "Medium"],
  ["A blessing in disguise", "Something good that seemed bad at first", ["A hidden enemy", "A fake gift", "A religious ritual"], "Medium"],
  ["Add fuel to the fire", "To make a bad situation worse", ["To cook food", "To help someone", "To calm things down"], "Easy"],
  ["At the eleventh hour", "At the last possible moment", ["Late at night", "Very early", "On time"], "Medium"],
  ["Cry over spilt milk", "To regret what cannot be undone", ["To waste milk", "To be very hungry", "To complain about food"], "Medium"],
  ["Hold one's horses", "To wait and be patient", ["To ride fast", "To stop a fight", "To own animals"], "Medium"],
  ["A red-letter day", "A memorable or important day", ["A day of danger", "A holiday for postmen", "A day of bad luck"], "Hard"],
  ["Bury the hatchet", "To make peace", ["To hide a weapon", "To plan an attack", "To dig a hole"], "Hard"],
  ["Turn a blind eye", "To deliberately ignore something", ["To lose one's sight", "To look closely", "To wink"], "Medium"],
  ["Hang by a thread", "To be in a very risky situation", ["To be very thin", "To sew carefully", "To be well supported"], "Hard"],
];
const ERRORS: [string, string, string[], Difficulty][] = [
  ["She don't like coffee.", "She doesn't like coffee.", ["She don't likes coffee.", "She not like coffee.", "She do not likes coffee."], "Easy"],
  ["Each of the students have a book.", "Each of the students has a book.", ["Each of the student have a book.", "Each of the students having a book.", "Each students has a book."], "Medium"],
  ["He is more taller than his brother.", "He is taller than his brother.", ["He is most taller than his brother.", "He is more tall than his brother.", "He is tallest than his brother."], "Easy"],
  ["I have been living here since five years.", "I have been living here for five years.", ["I am living here since five years.", "I have lived here since five years.", "I lived here since five years."], "Medium"],
  ["Neither the teacher nor the students was present.", "Neither the teacher nor the students were present.", ["Neither the teacher or the students was present.", "Neither the teacher nor the students is present.", "Either the teacher nor the students were present."], "Hard"],
  ["The news are very good today.", "The news is very good today.", ["The news were very good today.", "The new is very good today.", "The news are very well today."], "Medium"],
  ["He returned back home late.", "He returned home late.", ["He returned back to home late.", "He return back home late.", "He was returned back home late."], "Medium"],
  ["One of my friend is a doctor.", "One of my friends is a doctor.", ["One of my friends are a doctor.", "One of my friend are a doctor.", "One my friend is a doctor."], "Easy"],
  ["If I was you, I would apologise.", "If I were you, I would apologise.", ["If I am you, I would apologise.", "If I was you, I will apologise.", "If I be you, I would apologise."], "Hard"],
  ["The furniture were delivered yesterday.", "The furniture was delivered yesterday.", ["The furnitures were delivered yesterday.", "The furniture are delivered yesterday.", "The furnitures was delivered yesterday."], "Medium"],
  ["She is senior than me by two years.", "She is senior to me by two years.", ["She is more senior than me by two years.", "She is seniors to me by two years.", "She is senior from me by two years."], "Hard"],
  ["He did not came to school yesterday.", "He did not come to school yesterday.", ["He did not comes to school yesterday.", "He not came to school yesterday.", "He does not came to school yesterday."], "Easy"],
  ["We discussed about the problem.", "We discussed the problem.", ["We discussed on the problem.", "We discussed upon the problem.", "We were discussed the problem."], "Medium"],
];
const FILL: [string, string, string[], Difficulty][] = [
  ["She is good ___ mathematics.", "at", ["in", "on", "with"], "Easy"], ["He has been ill ___ Monday.", "since", ["for", "from", "by"], "Easy"],
  ["The book is ___ the table.", "on", ["at", "in", "over"], "Easy"], ["I prefer tea ___ coffee.", "to", ["than", "over", "from"], "Medium"],
  ["He is junior ___ me.", "to", ["than", "from", "of"], "Medium"], ["She was accused ___ theft.", "of", ["for", "with", "about"], "Medium"],
  ["He insisted ___ paying the bill.", "on", ["for", "at", "to"], "Medium"], ["The train arrived ___ time.", "on", ["at", "in", "by"], "Easy"],
  ["He is ___ honest man.", "an", ["a", "the", "no article"], "Easy"], ["She is ___ European writer.", "a", ["an", "the", "no article"], "Medium"],
  ["We must abide ___ the rules.", "by", ["with", "to", "on"], "Hard"], ["He is fond ___ music.", "of", ["for", "with", "about"], "Easy"],
  ["The thief was sentenced ___ prison for two years.", "to", ["for", "in", "at"], "Hard"], ["She congratulated him ___ his success.", "on", ["for", "at", "with"], "Medium"],
  ["He divided the cake ___ four pieces.", "into", ["in", "to", "between"], "Medium"], ["The money was distributed ___ the poor.", "among", ["between", "to", "with"], "Medium"],
  ["___ Ganga is a holy river.", "The", ["A", "An", "no article"], "Medium"], ["He has been working here ___ ten years.", "for", ["since", "from", "by"], "Easy"],
];
const SPELL: [string, string[], Difficulty][] = [
  ["Accommodate", ["Acommodate", "Accomodate", "Acomodate"], "Medium"], ["Necessary", ["Neccessary", "Necesary", "Neccesary"], "Medium"], ["Separate", ["Seperate", "Separete", "Seprate"], "Easy"],
  ["Definitely", ["Definately", "Definitly", "Defenitely"], "Easy"], ["Occurrence", ["Occurence", "Ocurrence", "Occurrance"], "Hard"], ["Embarrass", ["Embarass", "Embaras", "Emberrass"], "Hard"],
  ["Committee", ["Commitee", "Comittee", "Comitee"], "Medium"], ["Receive", ["Recieve", "Receeve", "Receve"], "Easy"], ["Millennium", ["Millenium", "Milennium", "Milenium"], "Hard"],
  ["Conscience", ["Conscence", "Concience", "Consience"], "Hard"], ["Government", ["Goverment", "Governmant", "Govenment"], "Easy"], ["Privilege", ["Priviledge", "Privelege", "Privilage"], "Hard"],
  ["Beginning", ["Begining", "Beggining", "Beginnig"], "Easy"], ["Maintenance", ["Maintainance", "Maintenence", "Mantenance"], "Hard"], ["Rhythm", ["Rythm", "Rhythem", "Rhytm"], "Medium"],
  ["Questionnaire", ["Questionaire", "Questionnair", "Qestionnaire"], "Hard"], ["Tomorrow", ["Tommorow", "Tomorow", "Tommorrow"], "Easy"], ["Achievement", ["Acheivement", "Achievment", "Acheivment"], "Medium"],
];

export const verbalAbility: Template[] = [
  (r) => { const [w, a, wr, d] = r.pick(SYNONYMS); return txt(r, Q(d, "Synonyms", "Word meaning", `Choose the word nearest in meaning to: ${w.toUpperCase()}`, `${w} means ${a.toLowerCase()}.`), a, wr); },
  (r) => { const [w, a, wr, d] = r.pick(ANTONYMS); return txt(r, Q(d, "Antonyms", "Opposite meaning", `Choose the word opposite in meaning to: ${w.toUpperCase()}`, `The opposite of ${w.toLowerCase()} is ${a.toLowerCase()}.`), a, wr); },
  (r) => { const [p, a, wr, d] = r.pick(ONE_WORD); return txt(r, Q(d, "One-Word Substitution", "Substitution", `Choose the one word for: "${p}"`, `"${p}" is called ${a.toLowerCase()}.`), a, wr); },
  (r) => { const [i, a, wr, d] = r.pick(IDIOMS); return txt(r, Q(d, "Idioms and Phrases", "Meaning", `What is the meaning of the idiom "${i}"?`, `"${i}" means: ${a.toLowerCase()}.`), a, wr); },
  (r) => { const [s, a, wr, d] = r.pick(ERRORS); return txt(r, Q(d, "Sentence Correction", "Grammar", `Choose the grammatically correct version of: "${s}"`, `Correct sentence: "${a}"`), a, wr); },
  (r) => { const [s, a, wr, d] = r.pick(FILL); return txt(r, Q(d, "Fill in the Blanks", "Prepositions and articles", `Fill in the blank: ${s}`, `The correct word is "${a}": ${s.replace("___", a)}`), a, wr); },
  (r) => { const [w, wr, d] = r.pick(SPELL); return txt(r, Q(d, "Spelling", "Correctly spelt word", `Which of these is spelt correctly: ${[w, ...wr].sort().join(" / ")}?`, `The correct spelling is ${w}.`), w, wr); },
];
