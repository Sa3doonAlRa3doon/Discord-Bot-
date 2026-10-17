export function parseDiceNotation(input) {
  const match = String(input).trim().toLowerCase().match(/^(\d{0,2})d(\d{1,4})([+-]\d{1,4})?$/);
  if (!match) return null;

  const count = Number(match[1] || 1);
  const sides = Number(match[2]);
  const modifier = Number(match[3] || 0);

  if (count < 1 || count > 20 || sides < 2 || sides > 1000 || Math.abs(modifier) > 10_000) {
    return null;
  }

  return { count, sides, modifier };
}

export function rollDice(notation, random = Math.random) {
  const parsed = parseDiceNotation(notation);
  if (!parsed) return null;

  const rolls = Array.from(
    { length: parsed.count },
    () => Math.floor(random() * parsed.sides) + 1
  );

  return {
    ...parsed,
    rolls,
    total: rolls.reduce((sum, roll) => sum + roll, 0) + parsed.modifier
  };
}

export function parseChoices(input, minimum = 2, maximum = 20) {
  const choices = String(input)
    .split('|')
    .map((choice) => choice.trim())
    .filter(Boolean);

  if (choices.length < minimum || choices.length > maximum || choices.some((choice) => choice.length > 80)) {
    return null;
  }

  return choices;
}
