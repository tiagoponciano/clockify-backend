export function buildSkipTake(page = 1, limit = 50): { skip: number; take: number } {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}
