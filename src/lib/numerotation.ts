const COUNTER_KEY = 'operationCounter';

interface Counter {
  year: number;
  sequence: number;
}

function readCounter(): Counter {
  const raw = localStorage.getItem(COUNTER_KEY);
  if (!raw) return { year: new Date().getFullYear(), sequence: 0 };
  try {
    return JSON.parse(raw) as Counter;
  } catch {
    return { year: new Date().getFullYear(), sequence: 0 };
  }
}

export function formatNumero(year: number, sequence: number): string {
  return `BCH-${year}-${String(sequence).padStart(6, '0')}`;
}

export function getNextOperationNumber(): string {
  const currentYear = new Date().getFullYear();
  const counter = readCounter();

  const year = currentYear;
  const sequence = counter.year === currentYear ? counter.sequence + 1 : 1;

  localStorage.setItem(COUNTER_KEY, JSON.stringify({ year, sequence }));
  return formatNumero(year, sequence);
}
