// Treat ordinary negative contractions as equivalent wording, without deleting
// negation or changing the raw answer retained in the evaluation report.
const negativeContractions = Object.freeze({
  "aren't": 'are not', "isn't": 'is not', "wasn't": 'was not',
  "weren't": 'were not', "don't": 'do not', "doesn't": 'does not',
  "didn't": 'did not', "haven't": 'have not', "hasn't": 'has not',
  "hadn't": 'had not', "can't": 'cannot', "couldn't": 'could not',
  "won't": 'will not', "wouldn't": 'would not', "shouldn't": 'should not',
  "mustn't": 'must not', "needn't": 'need not',
});

function normalizeEvaluationText(text) {
  return text.replace(/[\u2018\u2019]/g, "'").replace(
    /\b(?:aren't|isn't|wasn't|weren't|don't|doesn't|didn't|haven't|hasn't|hadn't|can't|couldn't|won't|wouldn't|shouldn't|mustn't|needn't)\b/gi,
    contraction => negativeContractions[contraction.toLowerCase()],
  );
}

function matchesCriterion(text, pattern) {
  const criterion = new RegExp(pattern, 'i');
  return criterion.test(text) || criterion.test(normalizeEvaluationText(text));
}

module.exports = { normalizeEvaluationText, matchesCriterion };
