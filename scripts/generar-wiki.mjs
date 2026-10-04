#!/usr/bin/env node
// Genera la GitHub Wiki desde `public_docs/` (Fase 16; detalle en scripts/lib/wiki.mjs y
// docs/DEPLOYMENT.md, «GitHub Wiki»). No publica nada: escribe en una carpeta, que suele ser
// el clon local del repositorio de la Wiki (`<repo>.wiki.git`). Quien publica hace commit y
// push en ese clon.
//
// Uso: npm run wiki:generar -- ../BPDF.wiki      (por defecto, wiki/ en este repo, ignorada)

import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generarWiki } from "./lib/wiki.mjs";

const { project } = await import("../src/config/project.ts");
const destino = path.resolve(process.argv[2] ?? "wiki");

const paginas = generarWiki({ raizRepo: process.cwd(), repositorio: project.repositoryUrl });

// La Wiki es una copia generada: se borran sus .md (no su .git) para que una página quitada
// de public_docs/ desaparezca también de la Wiki.
mkdirSync(destino, { recursive: true });
for (const f of readdirSync(destino)) {
  if (f.endsWith(".md")) rmSync(path.join(destino, f));
}
for (const [nombre, contenido] of paginas) writeFileSync(path.join(destino, nombre), contenido);
console.log(`✓ ${paginas.size} ficheros de la Wiki en ${destino}`);
