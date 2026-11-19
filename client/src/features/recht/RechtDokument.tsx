import type { ReactNode } from 'react';
import type { RechtBlock, RechtId } from '../../../../shared/recht/arten.ts';
import { RECHT_DOKUMENTE } from '../../../../shared/recht/dokumente.ts';
import { quellcodeAdresse } from '../../bauStand.ts';
import { tx } from '../../text.ts';
import { useSprache } from '../../sprache.tsx';

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

function erlaubteAdresse(href: string): boolean {
  return (href.startsWith('/') && !href.startsWith('//')) || href.startsWith('mailto:') || href.startsWith('https://') || href.startsWith('http://');
}

function Teile({ text }: { text: string }) {
  const knoten: ReactNode[] = [];
  let letzte = 0;
  for (const treffer of text.matchAll(LINK)) {
    const start = treffer.index ?? 0;
    const ganz = treffer[0];
    const label = treffer[1] ?? '';
    const href = treffer[2] ?? '';
    if (start > letzte) {
      knoten.push(text.slice(letzte, start));
    }
    if (erlaubteAdresse(href)) {
      const extern = href.startsWith('http://') || href.startsWith('https://');
      knoten.push(
        <a
          key={start}
          href={href}
          className="break-all underline underline-offset-2"
          target={extern ? '_blank' : undefined}
          rel={extern ? 'noopener noreferrer' : undefined}
        >
          {label}
        </a>,
      );
    } else {
      knoten.push(label);
    }
    letzte = start + ganz.length;
  }
  if (letzte < text.length) {
    knoten.push(text.slice(letzte));
  }
  return knoten;
}

function Quellcode() {
  const href = quellcodeAdresse();
  return (
    <p>
      <a href={href} className="break-all underline underline-offset-2" target="_blank" rel="noopener noreferrer">
        {tx('Quellcode dieser Version')}
      </a>
    </p>
  );
}

function Block({ block }: { block: RechtBlock }) {
  if (block.art === 'h') {
    return <h2 className="pt-2 text-base font-semibold">{block.text}</h2>;
  }
  if (block.art === 'liste') {
    return (
      <ul className="list-disc space-y-1 ps-5">
        {block.punkte.map((punkt) => (
          <li key={punkt}>
            <Teile text={punkt} />
          </li>
        ))}
      </ul>
    );
  }
  if (block.art === 'quelle') {
    return <Quellcode />;
  }
  return (
    <p>
      <Teile text={block.text} />
    </p>
  );
}

export function RechtDokument({ id }: { id: RechtId }) {
  const { sprache } = useSprache();
  return (
    <article data-recht="" className="max-w-[65ch] space-y-3 text-sm leading-6 break-words">
      {sprache !== 'de' ? <p className="text-leise">{tx('Maßgeblich ist die deutsche Fassung.')}</p> : null}
      {RECHT_DOKUMENTE[id].map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </article>
  );
}
