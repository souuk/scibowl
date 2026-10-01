import type { Packet } from '../src/types';
import { parseScienceBowlText } from '../src/parser/parseScienceBowlText';
import { validatePacket } from '../src/parser/validatePacket';
export const sample = `TOSS-UP
1) Biology — Short Answer What carries hereditary information?
ANSWER: DNA (ACCEPT: DEOXYRIBONUCLEIC ACID)
BONUS
1) Biology — Multiple Choice Which is an organelle?
W) Atom
X) Nucleus
Y) Star
Z) Planet
ANSWER: X) NUCLEUS
TOSS-UP
2) Physics Short Answer Name the SI unit of force.
ANSWER: NEWTON
BONUS
2) Physics Short Answer Name the SI unit of energy.
ANSWER: JOULE`;
export function testPacket(): Packet {
  const parsed = parseScienceBowlText({ pages: [{ page: 1, text: sample }] });
  return { id: 'test', fileName: 'test.pdf', fileHash: 'hash', pairs: validatePacket(parsed).pairs };
}
