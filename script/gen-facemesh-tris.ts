import fs from "fs";

const s = fs.readFileSync("node_modules/@mediapipe/face_mesh/face_mesh.js", "utf8");
const mark = 'P("FACEMESH_TESSELATION",';
const i = s.indexOf(mark);
if (i < 0) throw new Error("FACEMESH_TESSELATION not found");
let j = i + mark.length;
if (s[j] !== "[") throw new Error(`expected [, got ${s[j]}`);
let depth = 0;
let k = j;
for (; k < s.length; k++) {
  const c = s[k];
  if (c === "[") depth++;
  else if (c === "]") {
    depth--;
    if (depth === 0) {
      k++;
      break;
    }
  }
}
const pairs = JSON.parse(s.slice(j, k)) as [number, number][];
if (pairs.length % 3 !== 0) {
  throw new Error(`edge pairs not multiple of 3: ${pairs.length}`);
}
const out: number[] = [];
for (let t = 0; t < pairs.length; t += 3) {
  out.push(pairs[t]![0], pairs[t + 1]![0], pairs[t + 2]![0]);
}

const lines: string[] = [
  "// Auto-generated from @mediapipe/face_mesh — do not edit by hand.",
  "// FACEMESH_TESSELATION is edge triples per triangle; flattened for THREE.BufferGeometry.setIndex().",
  "export const FACEMESH_TESSELATION_TRIS: number[] = [",
];
let line = "  ";
for (let idx = 0; idx < out.length; idx++) {
  line += out[idx];
  if (idx < out.length - 1) line += ",";
  if ((idx + 1) % 18 === 0 || idx === out.length - 1) {
    lines.push(line);
    line = "  ";
  } else line += " ";
}
lines.push("];");
lines.push("");
fs.writeFileSync("client/src/lib/face-capture/facemesh-tesselation-tris.ts", lines.join("\n"));
console.log("triangles", out.length / 3, "indices", out.length);
