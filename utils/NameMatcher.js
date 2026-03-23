export const isNameMatch = (heard, target) => {
  if (!heard || !target) return false;
  const h = heard.toLowerCase().trim();
  const t = target.toLowerCase().trim();
  
  // Exact or simple includes
  if (h.includes(t)) return true;
  
  // Clean punctuation
  const cleanH = h.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
  const words = cleanH.split(' ');
  
  // Basic phonetic/fuzzy using Levenshtein distance (allow 1 typo/phonetic slip)
  for (let word of words) {
    if (levenshtein(word, t) <= 1) return true;
  }
  return false;
};

const levenshtein = (a, b) => {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
};
