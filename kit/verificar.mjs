#!/usr/bin/env node
/**
 * Comprueba que los archivos del kit sean exactamente los publicados: cada uno con el tamaño y la suma SHA-256 de
 * manifiesto.json, sin que falte ni sobre ninguno. Si un archivo se editó, se convirtió o se reemplazó, lo dice.
 *
 *   node verificar.mjs            desde la carpeta del kit
 *   node ruta/al/kit/verificar.mjs
 *
 * Sin dependencias: Node 18 o posterior.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const base = path.dirname(fileURLToPath(import.meta.url));
const manifiesto = JSON.parse(readFileSync(path.join(base, "manifiesto.json"), "utf8"));

const listar = (rel = "") =>
  readdirSync(path.join(base, rel)).flatMap((nombre) => {
    const r = rel ? `${rel}/${nombre}` : nombre;
    return statSync(path.join(base, r)).isDirectory() ? listar(r) : [r];
  });

const esperados = new Map(manifiesto.archivos.map((a) => [a.ruta, a]));
const problemas = [];
for (const [ruta, a] of esperados) {
  let datos;
  try {
    datos = readFileSync(path.join(base, ruta));
  } catch {
    problemas.push(`falta: ${ruta}`);
    continue;
  }
  if (datos.length !== a.bytes) problemas.push(`cambió de tamaño: ${ruta} (${datos.length} bytes; el manifiesto dice ${a.bytes})`);
  else if (createHash("sha256").update(datos).digest("hex") !== a.sha256) problemas.push(`cambió: ${ruta}`);
}
for (const ruta of listar()) {
  if (ruta === "manifiesto.json" || esperados.has(ruta)) continue;
  problemas.push(`sobra: ${ruta}`);
}

if (problemas.length) {
  console.error(`pteron ${manifiesto.version}: ${problemas.length} diferencia(s) con el manifiesto\n${problemas.map((p) => `  ${p}`).join("\n")}`);
  process.exit(1);
}
console.log(`pteron ${manifiesto.version} (${manifiesto.fecha}): los ${esperados.size} archivos coinciden con el manifiesto.`);
