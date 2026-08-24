import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * THE DISTINCTIONS ARE DIGITAL — a regression guard on copy, not on code.
 *
 * This site once told customers that a patch, a coin and a pin were packed in
 * the box with their print. They are not: five distinctions are conferred on
 * every mission, all five are honorary and digital, and the print is the only
 * object that arrives. The copy was corrected — and then drifted back twice,
 * in `FilmBand`, in the €349 tier body, and in a "What is included" list.
 *
 * It drifted because nothing guarded it. Prose has no type checker, so this
 * file is the type checker: it reads the shipped source and fails the build if
 * a delivery verb reappears next to a distinction.
 *
 * It is deliberately a SOURCE scan rather than a rendered-page assertion. The
 * defect is authored in a string literal, so catching it at the source is both
 * cheaper and stricter than driving a browser to nine widths to read it back.
 */

const ROOTS = ['app', 'components', 'lib'];
const NOUNS = ['patch', 'coin', 'badge', 'lapel pin', 'telemetry plate', 'mission plate'];

/** Verbs that assert an object moves through the post. */
const DELIVERY = [
  'ships with', 'ship with', 'shipped with', 'delivered with', 'delivers with',
  'packed with', 'packed in', 'arrives with', 'comes with', 'included in the box',
  'in the same box', 'in the parcel', 'things a customer will hold',
];

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) sources(full, out);
    else if (/\.(ts|tsx)$/.test(full)) out.push(full);
  }
  return out;
}

test('no source claims a distinction is delivered', () => {
  const hits: string[] = [];

  for (const root of ROOTS) {
    for (const file of sources(root)) {
      const lines = readFileSync(file, 'utf8').split('\n');
      lines.forEach((line, i) => {
        const low = line.toLowerCase();
        if (!NOUNS.some((n) => low.includes(n))) return;
        const verb = DELIVERY.find((v) => low.includes(v));
        if (!verb) return;

        /*
           A bare grep is useless here, because the three places most likely to
           contain the phrase are the three that must: a NEGATION ("nothing is
           packed with it"), a HISTORICAL QUOTE recording the defect in a
           docblock so it is not reintroduced, and the operator prompt teaching
           the model to answer "no" when a customer asks.

           The first run of this test found exactly those three and nothing
           else. So the check reads the sentence, not the line — comments wrap,
           and "Nothing is" routinely lands on the line above the verb.
        */
        const context = [lines[i - 1] ?? '', line, lines[i + 1] ?? ''].join(' ').toLowerCase();
        const negated = /\b(not|never|no longer|nothing|nobody|none|neither|do not|cannot|the answer is no)\b/.test(context);
        const historical = /\b(was|were|used to|previously|once|already|drifted|defect|regenerat)\b/.test(context);

        if (!negated && !historical) {
          hits.push(`${file}:${i + 1} — "${verb}" — ${line.trim().slice(0, 90)}`);
        }
      });
    }
  }

  expect(hits, `Distinctions are digital; nothing beyond the print is posted.\n${hits.join('\n')}`)
    .toEqual([]);
});

test('the operator is told the distinctions are digital', () => {
  const prompt = readFileSync('lib/integrations/llm.ts', 'utf8');
  // Without this the model improvises when a customer asks whether the patch
  // ships — and improvising here is a promise of a parcel nobody will send.
  expect(prompt).toContain('THE PRINT IS THE ONLY OBJECT THAT ARRIVES');
  expect(prompt.toLowerCase()).toContain('honorary and they are digital');
});

test('the honours block still states it in the customer-facing copy', () => {
  const block = readFileSync('components/mission/HonoursBlock.tsx', 'utf8');
  expect(block).toContain('honorary and they are digital');
  expect(block.toLowerCase()).toContain('the print is the only object');
});
