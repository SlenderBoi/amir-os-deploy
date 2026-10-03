import { describe, expect, it } from 'vitest';
import { normalize } from './CommandPalette';

describe('normalize', () => {
  it('unifies Arabic and Persian letters', () => expect(normalize('كتاب يادگيري')).toBe(normalize('کتاب یادگیری')));
  it('maps Persian and Arabic-Indic digits to ASCII', () => expect(normalize('۱۲۳ ٤٥٦')).toBe('123 456'));
});
