// Reads the legacy HTML, pulls the WFH_M / WFH_F array literals and the AGE_DATA
// raw CSV string, and writes the three reference TS modules verbatim.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('nutrition_tracker 18062026.html', 'utf8');

function grabArray(name) {
  const start = html.indexOf(`const ${name}=[`);
  if (start === -1) throw new Error(`${name} not found`);
  const open = html.indexOf('[', start);
  // find matching closing bracket of the outer array
  let depth = 0, i = open;
  for (; i < html.length; i++) {
    if (html[i] === '[') depth++;
    else if (html[i] === ']') { depth--; if (depth === 0) break; }
  }
  return html.slice(open, i + 1); // the literal "[[...],[...]]"
}

const wfhM = grabArray('WFH_M');
const wfhF = grabArray('WFH_F');

writeFileSync('src/domain/nutrition/reference/wfh-male.ts',
  `// Ported verbatim from legacy reference. Each row: [heightCm, b0,b1,b2,b3,b4,b5].\nexport const WFH_M: number[][] = ${wfhM};\n`);
writeFileSync('src/domain/nutrition/reference/wfh-female.ts',
  `// Ported verbatim from legacy reference. Each row: [heightCm, b0,b1,b2,b3,b4,b5].\nexport const WFH_F: number[][] = ${wfhF};\n`);

// AGE_DATA raw string lives inside: const raw=`...`;
const rawStart = html.indexOf('const raw=`');
const rawOpen = html.indexOf('`', rawStart);
const rawClose = html.indexOf('`', rawOpen + 1);
const raw = html.slice(rawOpen + 1, rawClose);

writeFileSync('src/domain/nutrition/reference/age-data.ts',
`// Ported verbatim from legacy reference (B.E. 2564 growth reference, ages 2–18).
export interface AgeRef {
  mw: number; sdw: number; sd2w: number; sd15w: number; sd15pw: number; sd2pw: number;
  mh: number; sdh: number; sd2h: number; sd15h: number; sd15ph: number; sd2ph: number;
}
const RAW = \`${raw}\`;
export const AGE_DATA: Record<string, AgeRef> = {};
RAW.split('\\n').forEach((line) => {
  const p = line.split(',');
  if (p.length < 13) return;
  AGE_DATA[p[0]] = {
    mw: +p[1], sdw: +p[2], sd2w: +p[3], sd15w: +p[4], sd15pw: +p[5], sd2pw: +p[6],
    mh: +p[7], sdh: +p[8], sd2h: +p[9], sd15h: +p[10], sd15ph: +p[11], sd2ph: +p[12],
  };
});
`);

console.log('Reference modules written.');
