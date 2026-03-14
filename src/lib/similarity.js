function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()（）_\-ー]/g, '');
}

function buildSimilarityWarning(type, currentName, matchedName) {
  return {
    code: `${type.toUpperCase()}_SIMILAR_NAME`,
    message: `類似した${type === 'company' ? '会社' : '案件'}名の候補があります。`,
    currentName,
    matchedName,
  };
}

function collectSimilarNameWarnings({ type, currentName, candidates }) {
  const normalizedCurrent = normalizeName(currentName);
  if (!normalizedCurrent) {
    return [];
  }

  const warnings = [];

  for (const candidate of candidates) {
    const normalizedCandidate = normalizeName(candidate.name);
    if (!normalizedCandidate || normalizedCandidate === normalizedCurrent) {
      continue;
    }

    if (
      normalizedCandidate.includes(normalizedCurrent) ||
      normalizedCurrent.includes(normalizedCandidate)
    ) {
      warnings.push(buildSimilarityWarning(type, currentName, candidate.name));
    }
  }

  return warnings;
}

module.exports = {
  collectSimilarNameWarnings,
};
