import { describe, expect, it } from 'vitest';
import { buildGuideComponents, buildNoMatchEmbed } from '../src/ui.js';

const config = {
  color: 0x7C3AED,
  swearMode: false,
  supportRole: '@Staff'
};

describe('Discord UI', () => {
  it('renders the no-match fallback without evaluating markdown as code', () => {
    const json = buildNoMatchEmbed(config).toJSON();
    expect(json.description).toContain('`/guide`');
    expect(json.description).toContain('couldn’t find a confident answer');
    expect(json.description).toContain('@Staff');
  });

  it('stays clean even if an old config tries to enable swear mode', () => {
    const json = buildNoMatchEmbed({ ...config, swearMode: true }).toJSON();
    expect(json.description).toContain('couldn’t find a confident answer');
  });

  it('keeps the guide within Discord component limits', () => {
    const rows = buildGuideComponents().map((row) => row.toJSON());
    expect(rows).toHaveLength(2);
    expect(rows[0].components[0].options).toHaveLength(5);
    expect(rows[1].components).toHaveLength(3);
  });
});
