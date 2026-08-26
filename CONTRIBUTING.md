# Contributing

Thanks for considering a contribution to RepoVitals.

## Local workflow

1. Fork the repository and create a focused branch.
2. Install dependencies with `npm ci`.
3. Make the smallest change that solves the problem.
4. Run `npm run lint`, `npm test`, and `npm run build`.
5. Open a pull request that explains the behavior change and its motivation.

Please include tests for scoring or data-handling changes. For interface changes, include before and after screenshots and verify the page at mobile and desktop widths.

## Scoring changes

Scoring should remain deterministic and explainable from public evidence. A proposal to add or rebalance a signal should explain why the signal helps evaluate portfolio presentation without rewarding popularity.
