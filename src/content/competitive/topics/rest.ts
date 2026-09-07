import type { CtCategory, CtPriority, CtTopic } from '../types';

/**
 * Topics beyond the Foundation category.
 *
 * Two are fully authored (sorting-techniques, coordinate-compression); the rest
 * are roadmap slots — category, priority, order and their place in the
 * relationship graph, enough to draw the roadmap and route the "learn next"
 * recommendation. Authoring a slot means filling in the teaching fields; the
 * route and progress row already work.
 */

function slot(
  category: CtCategory,
  id: string,
  title: string,
  titleKa: string,
  priority: CtPriority,
  order: number,
  rel: Partial<Pick<CtTopic, 'prerequisites' | 'related' | 'combinesWith' | 'next'>> = {},
): CtTopic {
  return {
    id,
    title,
    titleKa,
    category,
    priority,
    order,
    prerequisites: rel.prerequisites ?? [],
    related: rel.related ?? [],
    combinesWith: rel.combinesWith ?? [],
    next: rel.next ?? [],
  };
}

const sortingTechniques: CtTopic = {
  id: 'sorting-techniques',
  title: 'Sorting-based Techniques',
  titleKa: 'დახარისხების ხრიკები',
  category: 'core',
  priority: 'essential',
  order: 1,

  whatIs:
    'Not "how to sort" — `sort()` does that — but the meta-move: order the data ' +
    '(or a copy, or an index list) by a chosen key so that an ordering property ' +
    'makes the rest of the problem linear or easy.',

  intuition:
    'Many problems are hard only because the input is in arbitrary order. Impose ' +
    'an order that puts the elements you need to compare next to each other, and ' +
    'a nested loop becomes a single sweep.',

  whyItWorks:
    'After sorting, "the next relevant element" is always adjacent or reachable ' +
    'by a monotone pointer. The sort costs `O(n log n)` once and buys `O(n)` or ' +
    '`O(n log n)` for the main logic instead of `O(n^2)`. The skill is choosing ' +
    'the key — by value, by a pair, by start time, by a custom comparator.',

  naive:
    'Comparing every pair to find the two closest numbers, or checking every ' +
    'interval against every other for overlap, is `O(n^2)`. Sort by the right ' +
    'key and the answer is between adjacent elements, or falls out of one ' +
    'left-to-right pass with a running state: `O(n log n)`, dominated by the sort.',

  whenToUse: [
    '"Closest pair", "minimum difference", "k-th smallest" — sort, then adjacent or indexed',
    'Intervals — sort by start, or by end for a greedy',
    '"Match / assign greedily" — sort both sides and walk them together',
    'Offline queries — sort the queries into a favourable processing order',
    'Sorting by a custom key: (deadline, then penalty), (ratio), (end time)',
  ],

  signals: [
    '"minimum / maximum difference between any two", "closest"',
    '"intervals", "segments", "meetings", "ranges" needing pairing or overlap counts',
    '"you may answer the queries in any order" (offline)',
    'An O(n^2) pair comparison that a 1-D order would make adjacent',
    '"sort the ... by ..." is often literally the first line of the editorial',
  ],

  walkthrough: [
    'Minimum absolute difference between any two of a = [8, 1, 5, 12, 3].',
    'Naive: check all 10 pairs.',
    'Sort → [1, 3, 5, 8, 12]. If x < y < z then y is closer to both than x is to z, so the closest pair must be adjacent.',
    'Adjacent diffs: 2, 2, 3, 4 → minimum 2. One pass over n−1 pairs.',
  ],

  cpp: [
    {
      caption: 'Sort then sweep: merge overlapping intervals',
      code: `#include <bits/stdc++.h>
using namespace std;

int main() {
    int n; cin >> n;
    vector<pair<long long,long long>> v(n);
    for (auto& [l, r] : v) cin >> l >> r;
    sort(v.begin(), v.end());                 // by start, then end

    vector<pair<long long,long long>> merged;
    for (auto& [l, r] : v) {
        if (!merged.empty() && l <= merged.back().second)
            merged.back().second = max(merged.back().second, r);   // extend
        else
            merged.push_back({l, r});                              // new block
    }
    for (auto& [l, r] : merged) cout << l << " " << r << "\n";
}`,
    },
    {
      caption: 'Sort an index array — keep the original data in place',
      code: `vector<int> idx(n);
iota(idx.begin(), idx.end(), 0);              // 0, 1, 2, ...
sort(idx.begin(), idx.end(),
     [&](int i, int j) { return a[i] < a[j]; });  // strict "<", never "<="
// now a[idx[0]] is the smallest, and idx[k] is its original position`,
    },
  ],

  time: 'O(n log n) for the sort; the technique on top is usually O(n) or O(n log n). Dominated by the sort.',
  space:
    'O(n) if you sort a copy or an index array; O(log n) stack for the sort; ' +
    'O(1) extra if you sort in place and only sweep.',

  mistakes: [
    'Sorting the values but needing the original indices — sort an index array, or sort `(value, index)` pairs.',
    'A comparator that is not a strict weak ordering — `return a <= b;` can crash `std::sort`. Use strict `<`.',
    'Sorting by the wrong key — by start when the greedy needs end, or the reverse.',
    'Overflow in a ratio comparator (`a.x * b.y`) — cross-multiply in `long long`.',
    'Forgetting that sorting destroys an input order a later part of the problem still needs.',
  ],

  edgeCases: [
    'n ≤ 1 — nothing to compare; handle before the sorting logic.',
    'All elements equal — adjacent differences are 0; the comparator must stay strict.',
    'Already sorted or reverse sorted — still O(n log n), no special case.',
    'Duplicate keys under a custom comparator — decide whether ties need a secondary key or `stable_sort`.',
  ],

  exercises: [
    'Given points on a line, find the two closest.',
    'Merge a list of intervals.',
    'Sort n items by value/weight ratio (the fractional-knapsack setup).',
    'Sort strings by length, breaking ties lexicographically.',
  ],

  practice: [
    { name: 'CSES — Restaurant Customers', tag: 'CSES', url: 'https://cses.fi/problemset/task/1619' },
    { name: 'CSES — Movie Festival', tag: 'CSES', url: 'https://cses.fi/problemset/task/1629' },
    { name: 'Codeforces 489B — BerSU Ball', tag: 'CF 1200', url: 'https://codeforces.com/problemset/problem/489/B' },
  ],

  combineNote:
    'Sorting is the setup for two pointers (both pointers assume order), for ' +
    'binary search and `lower_bound` (need a sorted array), and for greedy (sort ' +
    'by the exchange-argument key, then take in order). Coordinate compression is ' +
    'sorting the distinct values and replacing each by its rank. Sweep-line sorts ' +
    'the events by coordinate and processes them in order.',

  prerequisites: ['two-pointers'],
  related: ['two-pointers', 'binary-search', 'greedy', 'coordinate-compression'],
  combinesWith: ['two-pointers', 'binary-search', 'greedy'],
  next: ['coordinate-compression', 'greedy'],
};

const coordinateCompression: CtTopic = {
  id: 'coordinate-compression',
  title: 'Coordinate Compression',
  titleKa: 'კოორდინატების შეკუმშვა',
  category: 'core',
  priority: 'important',
  order: 2,

  whatIs:
    'Replace a set of values that spans a huge range (up to 10^9 or 10^18) but ' +
    'has only n distinct entries with their ranks 0..k−1. Order is preserved, so ' +
    'any order-based structure now fits in an array of size k.',

  intuition:
    'The actual magnitudes rarely matter — only the relative order does. So ' +
    'relabel the values 0, 1, 2, ... by their position in sorted order.',

  whyItWorks:
    'Sort the distinct values; the rank of a value is its index in that list, ' +
    'found by `lower_bound` in `O(log k)`. Ranks are a bijection that preserves ' +
    '`<`, so every comparison, every "count values in [l, r]", every prefix ' +
    'structure gives the same answer on ranks as on the originals — but now the ' +
    'index space is `k`, not 10^9.',

  naive:
    'You want a Fenwick tree or a frequency array indexed by value, but the ' +
    'values reach 10^9 and the array will not allocate. A `map` works but adds a ' +
    'log factor and a heavy constant and cannot do the O(1) prefix tricks. ' +
    'Compression shrinks the index space to n so the fast array-based structure ' +
    'applies unchanged.',

  whenToUse: [
    'You need an array / Fenwick / segment tree indexed by value, but values are huge',
    '"Count inversions", "for each element count smaller elements to its right"',
    'Values are huge but only their order matters — ranks, medians, "k-th distinct"',
    '2D problems — compress each axis independently',
  ],

  signals: [
    '"values up to 10^9" (or 10^18, or "coordinates") together with a need to index by them',
    '"count inversions", "count pairs (i, j) with i < j and a[i] > a[j]"',
    '"how many values are less than x" over many queries, x from a huge range',
    'A Fenwick / segment-tree idea that only fails because the value range is too big',
  ],

  walkthrough: [
    'a = [100, 5, 100, 999999, 5].',
    'Distinct, sorted: [5, 100, 999999].',
    'rank(5) = 0, rank(100) = 1, rank(999999) = 2, each via lower_bound.',
    'Compressed array: [1, 0, 1, 2, 0].',
    'A Fenwick tree of size 3 can now count "values ≤ x seen so far" during a sweep — impossible on the raw values.',
  ],

  cpp: [
    {
      caption: 'The compression itself — a reusable helper',
      code: `#include <bits/stdc++.h>
using namespace std;

// returns the rank array; \`sorted\` maps a rank back to its original value
vector<int> compress(const vector<long long>& a, vector<long long>& sorted) {
    sorted = a;
    sort(sorted.begin(), sorted.end());
    sorted.erase(unique(sorted.begin(), sorted.end()), sorted.end());  // distinct!
    vector<int> rank(a.size());
    for (size_t i = 0; i < a.size(); i++)
        rank[i] = lower_bound(sorted.begin(), sorted.end(), a[i]) - sorted.begin();
    return rank;
}`,
    },
    {
      caption: 'Its canonical use: count inversions (Fenwick tree covered in its own topic)',
      code: `// bit[] is a Fenwick tree of size k; add(i) and query(i) are its O(log k) ops
long long inversions = 0;
vector<int> r = compress(a, sorted);
for (int i = (int)r.size() - 1; i >= 0; i--) {
    inversions += query(r[i] - 1);   // how many already-seen values are strictly smaller
    add(r[i]);                        // this value is now to the right of everything earlier
}`,
    },
  ],

  time: 'O(n log n) to sort and dedupe; O(log k) per rank lookup. Dominated by the sort.',
  space: 'O(n) for the sorted distinct list and the rank array.',

  mistakes: [
    'Using `sort` without `unique` — ranks then skip numbers and the compressed range has gaps.',
    'Off-by-one: `lower_bound(...) - begin()` is the rank; `upper_bound` shifts everything by one.',
    'Needing to map a rank back to a value and not keeping the sorted distinct list.',
    'Comparing against a query value that was not in the original set — insert query values into the compression too, or reason carefully about "between two ranks".',
    'Assuming compression preserves gaps — "is a[i] + 1 present" is not "rank + 1".',
  ],

  edgeCases: [
    'All values equal — one distinct value, every rank 0, compressed size 1.',
    'Values already 0..n−1 — compression is the identity, harmless.',
    'Negative values — sorting handles them; ranks stay 0-based.',
    'Query values outside the set — decide up front whether to add them.',
    'n = 0 — empty distinct list, nothing to rank.',
  ],

  exercises: [
    'Compress an array and verify the relative order is unchanged.',
    'Count inversions in an array with values up to 10^9.',
    'Given segments with huge endpoints, compress them and mark covered cells in a difference array.',
    'For each element, how many distinct smaller values appear before it.',
  ],

  practice: [
    { name: 'LeetCode 315 — Count of Smaller Numbers After Self', tag: 'LC Hard', url: 'https://leetcode.com/problems/count-of-smaller-numbers-after-self/' },
    { name: 'CSES — Nested Ranges Count', tag: 'CSES', url: 'https://cses.fi/problemset/task/2170' },
    { name: 'Codeforces 1042D — Petya and Array', tag: 'CF 1800', url: 'https://codeforces.com/problemset/problem/1042/D' },
  ],

  combineNote:
    'Coordinate compression is sorting plus `lower_bound` — the adapter that lets ' +
    'a Fenwick tree or segment tree work when the value range is too large to ' +
    'index. It is the standard first step for offline range-count problems, ' +
    'sweep-line over large coordinates, and 2D problems (compress each axis). ' +
    'Everything downstream — prefix sums, difference arrays, BIT — is unchanged.',

  prerequisites: ['sorting-techniques', 'frequency-arrays'],
  related: ['sorting-techniques', 'binary-search', 'fenwick-tree', 'segment-tree'],
  combinesWith: ['fenwick-tree', 'segment-tree', 'prefix-sums', 'difference-arrays'],
  next: ['fenwick-tree'],
};

export const CORE_TOPICS: CtTopic[] = [
  sortingTechniques,
  coordinateCompression,
  slot('core', 'backtracking', 'Backtracking', 'უკუდახევა', 'essential', 3, {
    prerequisites: ['recursion'],
    related: ['bitmask-enumeration', 'dfs', 'constructive'],
    combinesWith: ['bitmask-enumeration', 'meet-in-the-middle'],
    next: ['bitmask-enumeration', 'constructive'],
  }),
  slot('core', 'bitmask-enumeration', 'Bitmask Enumeration', 'ბიტმასკის ჩამოთვლა', 'important', 4, {
    prerequisites: ['bit-manipulation', 'backtracking'],
    related: ['bitmask-dp', 'meet-in-the-middle'],
    combinesWith: ['bitmask-dp', 'meet-in-the-middle'],
    next: ['bitmask-dp', 'meet-in-the-middle'],
  }),
  slot('core', 'constructive', 'Constructive Algorithms', 'კონსტრუქციული ალგორითმები', 'important', 5, {
    prerequisites: ['invariants'],
    related: ['greedy', 'invariants'],
    combinesWith: ['greedy', 'invariants'],
    next: ['greedy'],
  }),
  slot('core', 'invariants', 'Invariants', 'ინვარიანტები', 'important', 6, {
    prerequisites: [],
    related: ['constructive', 'greedy'],
    combinesWith: ['constructive', 'greedy'],
    next: ['constructive'],
  }),
];

export const GREEDY_SEARCH_TOPICS: CtTopic[] = [
  slot('greedy-search', 'greedy', 'Greedy & Exchange Argument', 'ხარბი ალგორითმები', 'essential', 1, {
    prerequisites: ['sorting-techniques'],
    related: ['invariants', 'constructive', 'mst'],
    combinesWith: ['sorting-techniques', 'priority-queue'],
    next: ['binary-search-on-answer'],
  }),
  slot('greedy-search', 'binary-search-on-answer', 'Binary Search on Answer', 'ბინარული ძებნა პასუხზე', 'essential', 2, {
    prerequisites: ['binary-search', 'greedy'],
    related: ['ternary-search', 'prefix-sums'],
    combinesWith: ['greedy', 'prefix-sums', 'two-pointers'],
    next: ['ternary-search'],
  }),
  slot('greedy-search', 'ternary-search', 'Ternary Search', 'ტერნარული ძებნა', 'advanced', 3, {
    prerequisites: ['binary-search-on-answer'],
    related: ['binary-search'],
    combinesWith: ['binary-search-on-answer'],
    next: ['meet-in-the-middle'],
  }),
  slot('greedy-search', 'meet-in-the-middle', 'Meet in the Middle', 'შუაში შეხვედრა', 'advanced', 4, {
    prerequisites: ['bitmask-enumeration', 'sorting-techniques'],
    related: ['bitmask-dp', 'two-pointers'],
    combinesWith: ['two-pointers', 'binary-search'],
    next: [],
  }),
];

export const GRAPH_TOPICS: CtTopic[] = [
  slot('graphs', 'bfs', 'BFS', 'BFS', 'essential', 1, {
    prerequisites: ['recursion'],
    related: ['dfs', 'connected-components', '01-bfs'],
    combinesWith: ['connected-components', 'flood-fill'],
    next: ['dfs', 'connected-components'],
  }),
  slot('graphs', 'dfs', 'DFS', 'DFS', 'essential', 2, {
    prerequisites: ['recursion'],
    related: ['bfs', 'trees', 'topological-sort'],
    combinesWith: ['connected-components', 'topological-sort', 'tree-dp'],
    next: ['connected-components', 'topological-sort', 'trees'],
  }),
  slot('graphs', 'connected-components', 'Connected Components', 'ბმული კომპონენტები', 'essential', 3, {
    prerequisites: ['bfs', 'dfs'],
    related: ['dsu', 'flood-fill'],
    combinesWith: ['dsu', 'flood-fill'],
    next: ['flood-fill', 'dsu'],
  }),
  slot('graphs', 'flood-fill', 'Flood Fill', 'შევსება', 'important', 4, {
    prerequisites: ['bfs', 'connected-components'],
    related: ['dfs', 'connected-components'],
    combinesWith: ['connected-components'],
    next: ['dijkstra'],
  }),
  slot('graphs', 'topological-sort', 'Topological Sort', 'ტოპოლოგიური დახარისხება', 'essential', 5, {
    prerequisites: ['dfs'],
    related: ['dfs', 'dp-fundamentals'],
    combinesWith: ['dp-fundamentals', 'dfs'],
    next: ['dijkstra'],
  }),
  slot('graphs', 'dijkstra', "Dijkstra's Algorithm", 'დейკსტრა', 'essential', 6, {
    prerequisites: ['bfs', 'priority-queue'],
    related: ['01-bfs', 'mst'],
    combinesWith: ['priority-queue', 'binary-search-on-answer'],
    next: ['01-bfs', 'mst'],
  }),
  slot('graphs', '01-bfs', '0–1 BFS', '0–1 BFS', 'important', 7, {
    prerequisites: ['bfs', 'dijkstra'],
    related: ['dijkstra'],
    combinesWith: ['dijkstra'],
    next: ['mst'],
  }),
  slot('graphs', 'mst', 'Minimum Spanning Tree', 'მინიმალური დამფარავი ხე', 'important', 8, {
    prerequisites: ['dsu', 'sorting-techniques'],
    related: ['dsu', 'greedy'],
    combinesWith: ['dsu', 'greedy'],
    next: [],
  }),
  slot('graphs', 'dsu', 'Disjoint Set Union', 'გაერთიანება-პოვნა', 'essential', 9, {
    prerequisites: ['connected-components'],
    related: ['mst', 'connected-components'],
    combinesWith: ['mst', 'sorting-techniques', 'coordinate-compression'],
    next: ['mst'],
  }),
  slot('graphs', 'trees', 'Trees & Tree Traversal', 'ხეები', 'essential', 10, {
    prerequisites: ['dfs'],
    related: ['tree-dp', 'lca'],
    combinesWith: ['tree-dp', 'lca', 'dfs'],
    next: ['lca', 'tree-dp'],
  }),
  slot('graphs', 'lca', 'Lowest Common Ancestor', 'უახლოესი საერთო წინაპარი', 'advanced', 11, {
    prerequisites: ['trees', 'sparse-table'],
    related: ['sparse-table', 'tree-dp'],
    combinesWith: ['sparse-table', 'tree-dp'],
    next: [],
  }),
];

export const DP_TOPICS: CtTopic[] = [
  slot('dp', 'dp-fundamentals', 'DP Fundamentals', 'DP საფუძვლები', 'essential', 1, {
    prerequisites: ['recursion'],
    related: ['memoization-vs-iterative', 'knapsack'],
    combinesWith: ['memoization-vs-iterative'],
    next: ['memoization-vs-iterative', 'knapsack', 'grid-dp'],
  }),
  slot('dp', 'memoization-vs-iterative', 'Memoization vs Iterative DP', 'მემოიზაცია vs იტერაციული', 'essential', 2, {
    prerequisites: ['dp-fundamentals'],
    related: ['dp-fundamentals', 'topological-sort'],
    combinesWith: ['topological-sort'],
    next: ['knapsack', 'grid-dp'],
  }),
  slot('dp', 'knapsack', 'Knapsack', 'ზურგჩანთა', 'essential', 3, {
    prerequisites: ['dp-fundamentals'],
    related: ['lis', 'bitmask-dp'],
    combinesWith: ['prefix-sums', 'frequency-arrays'],
    next: ['lis', 'grid-dp'],
  }),
  slot('dp', 'lis', 'Longest Increasing Subsequence', 'უგრძესი ზრდადი ქვემიმდევრობა', 'important', 4, {
    prerequisites: ['dp-fundamentals', 'binary-search'],
    related: ['knapsack', 'coordinate-compression'],
    combinesWith: ['binary-search', 'fenwick-tree'],
    next: ['grid-dp'],
  }),
  slot('dp', 'grid-dp', 'Grid DP', 'ბადის DP', 'essential', 5, {
    prerequisites: ['dp-fundamentals'],
    related: ['knapsack', 'prefix-sums'],
    combinesWith: ['prefix-sums'],
    next: ['bitmask-dp', 'tree-dp'],
  }),
  slot('dp', 'bitmask-dp', 'Bitmask DP', 'ბიტმასკის DP', 'advanced', 6, {
    prerequisites: ['bitmask-enumeration', 'dp-fundamentals'],
    related: ['meet-in-the-middle', 'knapsack'],
    combinesWith: ['meet-in-the-middle'],
    next: ['tree-dp'],
  }),
  slot('dp', 'tree-dp', 'Tree DP', 'DP ხეზე', 'advanced', 7, {
    prerequisites: ['trees', 'dp-fundamentals'],
    related: ['dfs', 'lca'],
    combinesWith: ['dfs', 'lca'],
    next: [],
  }),
];

export const DS_TOPICS: CtTopic[] = [
  slot('data-structures', 'stack-queue-deque', 'Stack / Queue / Deque', 'სტეკი / რიგი / დეკი', 'essential', 1, {
    prerequisites: [],
    related: ['monotonic-stack', 'monotonic-queue', 'priority-queue'],
    combinesWith: ['bfs', 'dfs'],
    next: ['priority-queue', 'monotonic-stack'],
  }),
  slot('data-structures', 'priority-queue', 'Priority Queue', 'პრიორიტეტული რიგი', 'essential', 2, {
    prerequisites: ['stack-queue-deque'],
    related: ['dijkstra', 'greedy'],
    combinesWith: ['dijkstra', 'greedy'],
    next: ['set-map'],
  }),
  slot('data-structures', 'set-map', 'Set / Map', 'სიმრავლე / ასოციაცია', 'essential', 3, {
    prerequisites: ['stack-queue-deque'],
    related: ['frequency-arrays', 'coordinate-compression'],
    combinesWith: ['sliding-window', 'two-pointers'],
    next: ['monotonic-stack'],
  }),
  slot('data-structures', 'monotonic-stack', 'Monotonic Stack', 'მონოტონური სტეკი', 'important', 4, {
    prerequisites: ['stack-queue-deque'],
    related: ['monotonic-queue', 'sliding-window'],
    combinesWith: ['sliding-window'],
    next: ['monotonic-queue'],
  }),
  slot('data-structures', 'monotonic-queue', 'Monotonic Queue', 'მონოტონური რიგი', 'important', 5, {
    prerequisites: ['stack-queue-deque', 'sliding-window'],
    related: ['monotonic-stack', 'sliding-window'],
    combinesWith: ['sliding-window'],
    next: ['sparse-table'],
  }),
  slot('data-structures', 'segment-tree', 'Segment Tree', 'სეგმენტ-ხე', 'advanced', 6, {
    prerequisites: ['recursion', 'coordinate-compression'],
    related: ['fenwick-tree', 'sparse-table'],
    combinesWith: ['coordinate-compression', 'binary-search'],
    next: ['fenwick-tree'],
  }),
  slot('data-structures', 'fenwick-tree', 'Fenwick Tree', 'ფენვიკის ხე', 'advanced', 7, {
    prerequisites: ['prefix-sums', 'bit-manipulation'],
    related: ['segment-tree', 'coordinate-compression'],
    combinesWith: ['coordinate-compression', 'difference-arrays'],
    next: ['sparse-table'],
  }),
  slot('data-structures', 'sparse-table', 'Sparse Table', 'იშვიათი ცხრილი', 'advanced', 8, {
    prerequisites: ['bit-manipulation'],
    related: ['segment-tree', 'lca'],
    combinesWith: ['lca', 'binary-search'],
    next: ['lca'],
  }),
];

export const MATH_TOPICS: CtTopic[] = [
  slot('math', 'gcd-lcm', 'GCD / LCM', 'უდიდესი საერთო გამყოფი', 'essential', 1, {
    prerequisites: [],
    related: ['prime-factorization', 'modular-arithmetic'],
    combinesWith: ['modular-arithmetic'],
    next: ['sieve'],
  }),
  slot('math', 'sieve', 'Sieve of Eratosthenes', 'ერატოსთენეს საცერი', 'essential', 2, {
    prerequisites: ['frequency-arrays'],
    related: ['prime-factorization'],
    combinesWith: ['prime-factorization'],
    next: ['prime-factorization'],
  }),
  slot('math', 'prime-factorization', 'Prime Factorization', 'მარტივ მამრავლებად დაშლა', 'important', 3, {
    prerequisites: ['sieve', 'gcd-lcm'],
    related: ['sieve', 'modular-arithmetic'],
    combinesWith: ['sieve'],
    next: ['modular-arithmetic'],
  }),
  slot('math', 'modular-arithmetic', 'Modular Arithmetic', 'მოდულური არითმეტიკა', 'essential', 4, {
    prerequisites: ['gcd-lcm'],
    related: ['fast-exponentiation'],
    combinesWith: ['fast-exponentiation'],
    next: ['fast-exponentiation'],
  }),
  slot('math', 'fast-exponentiation', 'Fast Exponentiation', 'სწრაფი ახარისხება', 'essential', 5, {
    prerequisites: ['modular-arithmetic', 'bit-manipulation'],
    related: ['modular-arithmetic'],
    combinesWith: ['modular-arithmetic'],
    next: [],
  }),
];
