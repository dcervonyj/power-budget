import { describe, expect, it } from 'vitest';
import {
  findNeedsTranslation,
  mergeLegacyMessages,
  splitNewMessages,
} from '../ExtractedMessageFilter.mjs';

describe('ExtractedMessageFilter', () => {
  it('adds new extracted ids after the existing ones, sorted, and refreshes known text', () => {
    const merged = mergeLegacyMessages(
      { 'b.old': 'Old B', 'a.old': 'Old A' },
      { 'z.new': 'New Z', 'b.old': 'Fresh B', 'c.new': 'New C' },
    );

    expect(Object.entries(merged)).toEqual([
      ['b.old', 'Fresh B'],
      ['a.old', 'Old A'],
      ['c.new', 'New C'],
      ['z.new', 'New Z'],
    ]);
  });

  it('lists the English ids each translated locale still lacks', () => {
    const needsTranslation = findNeedsTranslation(
      { 'a.one': 'One', 'a.two': 'Two' },
      { pl: { 'a.one': 'Jeden', 'a.two': 'Dwa' }, uk: { 'a.one': 'Один' }, ru: {} },
    );

    expect(needsTranslation).toEqual({
      pl: {},
      uk: { 'a.two': 'Two' },
      ru: { 'a.one': 'One', 'a.two': 'Two' },
    });
  });

  it('routes new ids into the feature catalog named by their first segment', () => {
    const { legacy, features } = splitNewMessages(
      { 'tx.row.choose': 'Choose', 'bulk.clear': 'Clear', 'tx.list.over': 'Over' },
      ['tx.json', 'banks.json'],
    );

    expect(legacy).toEqual({ 'bulk.clear': 'Clear' });
    expect(features).toEqual({ 'tx.json': { 'tx.row.choose': 'Choose', 'tx.list.over': 'Over' } });
  });
});
