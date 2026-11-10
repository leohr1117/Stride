import { tx } from '../text.ts';

const ZIEL = 'https://leohr.de';

export function Absender({ className = '' }: { className?: string }) {
  const klasse = ['text-center text-[13px] leading-[18px] break-words text-leise', className].filter(Boolean).join(' ');
  return (
    <p data-absender="" className={klasse}>
      {tx('von')}{' '}
      <a href={ZIEL} target="_blank" rel="noopener" className="underline">
        leohr
      </a>
    </p>
  );
}
