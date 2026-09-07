import type { CtTopic } from '../types';

/**
 * FOUNDATION — the array-scanning techniques every contest problem assumes you
 * already know. The first five are fully authored; the rest are roadmap slots.
 */

const prefixSums: CtTopic = {
  id: 'prefix-sums',
  title: 'Prefix Sums',
  titleKa: 'პრეფიქს-ჯამები',
  category: 'foundation',
  priority: 'essential',
  order: 1,

  whatIs:
    'A prefix sum array `p` where `p[i]` holds the sum of the first `i` elements. ' +
    'Built once in O(n), it turns any range-sum query `sum(l..r)` into the single ' +
    'subtraction `p[r+1] - p[l]`.',

  intuition:
    'Precompute every "sum from the start". The sum of a middle segment is then ' +
    'just the difference of two of those — the shared front cancels out.',

  whyItWorks:
    'sum(l..r) = (sum of 0..r) - (sum of 0..l-1). Both operands are already ' +
    'stored, so the query touches two cells regardless of how wide the range is. ' +
    'Using `p` of length n+1 with `p[0] = 0` removes the special case at l = 0.',

  naive:
    'The obvious solution answers each query with a loop from l to r: O(n) per ' +
    'query, O(n·q) total. With n, q up to 2·10^5 that is 4·10^10 operations — far ' +
    'past the ~10^8 a second budget. Prefix sums move the work to a one-time O(n) ' +
    'pass, after which every query is O(1), for O(n + q) overall.',

  whenToUse: [
    'Many range-sum (or range-count) queries over an array that does not change',
    'You need "sum of elements in [l, r]" as a fast subroutine inside a larger algorithm',
    'Counting how many values fall in a range, after bucketing them into an array',
  ],

  signals: [
    '"answer q queries, each asking for the sum / average / count over a subarray"',
    '"the array is given once and never modified"',
    '"for every index, you need the total to its left"',
    'A brute-force double loop where the inner loop only accumulates a sum',
  ],

  walkthrough: [
    'Array a = [3, 1, 4, 1, 5], 0-indexed. Query: sum of a[1..3] (values 1, 4, 1 = 6).',
    'Build p of length 6 with p[0] = 0.',
    'p[1] = p[0] + a[0] = 3; p[2] = 3 + 1 = 4; p[3] = 4 + 4 = 8; p[4] = 8 + 1 = 9; p[5] = 9 + 5 = 14.',
    'sum(1..3) = p[4] - p[1] = 9 - 3 = 6. Correct, in one subtraction.',
    'A second query sum(0..4) = p[5] - p[0] = 14 - 0 = 14, again O(1).',
  ],

  cpp: [
    {
      caption: '1D prefix sums with range queries',
      code: `#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, q;
    cin >> n >> q;
    vector<long long> p(n + 1, 0);        // p[0] = 0, size n+1 avoids l==0 case
    for (int i = 0; i < n; i++) {
        long long x; cin >> x;
        p[i + 1] = p[i] + x;              // sums can overflow int — use long long
    }
    while (q--) {
        int l, r; cin >> l >> r;          // inclusive, 0-indexed
        cout << p[r + 1] - p[l] << "\\n";  // sum of a[l..r]
    }
}`,
    },
    {
      caption: '2D prefix sums — sum over a submatrix in O(1)',
      code: `// p[i][j] = sum of the rectangle from (0,0) to (i-1,j-1)
vector<vector<long long>> p(n + 1, vector<long long>(m + 1, 0));
for (int i = 0; i < n; i++)
    for (int j = 0; j < m; j++)
        p[i + 1][j + 1] = a[i][j] + p[i][j + 1] + p[i + 1][j] - p[i][j];

// sum of the rectangle with corners (r1,c1) and (r2,c2), inclusive:
auto rect = [&](int r1, int c1, int r2, int c2) {
    return p[r2 + 1][c2 + 1] - p[r1][c2 + 1] - p[r2 + 1][c1] + p[r1][c1];
};`,
    },
  ],

  time: 'O(n) preprocessing, O(1) per query. 2D: O(n·m) build, O(1) per rectangle.',
  space: 'O(n) for the prefix array (O(n·m) in 2D). The original array can be discarded.',

  mistakes: [
    'Storing sums in `int` — a range of 2·10^5 values near 10^9 overflows. Use `long long`.',
    'Off-by-one: with a length-n `p` you must special-case l = 0. A length-(n+1) `p` with p[0] = 0 does not.',
    'Applying it to an array that changes between queries — then you need a Fenwick tree instead.',
    '2D: forgetting the `+ p[i][j]` inclusion–exclusion term, which is subtracted twice otherwise.',
  ],

  edgeCases: [
    'l == r: a single element, sum = p[r+1] - p[r] = a[r].',
    'Empty range (if the problem allows l > r): define it as 0, i.e. p[l] - p[l].',
    'All negatives: still correct — prefix sums make no sign assumption.',
    'n == 0: p = [0], no query is valid, but the build does not crash.',
  ],

  exercises: [
    'Given an array, answer: "is the sum of a[l..r] equal to zero?" in O(1) per query.',
    'Count subarrays with sum exactly k using a hash map of prefix-sum frequencies (O(n)).',
    'Given a 0/1 array, find the longest subarray with equal counts of 0 and 1.',
  ],

  practice: [
    { name: 'Codeforces 466C — Number of Ways', tag: 'CF 1700', url: 'https://codeforces.com/problemset/problem/466/C' },
    { name: 'USACO 2016 Jan Bronze — Angry Cows (prefix idea)', tag: 'USACO Bronze' },
    { name: 'CSES — Subarray Sums II', tag: 'CSES', url: 'https://cses.fi/problemset/task/1661' },
  ],

  combineNote:
    'Prefix sums are the base layer for difference arrays (their inverse), for ' +
    '2D range queries, and for the "count subarrays with property X" family when ' +
    'paired with a hash map. Binary search on a prefix array locates the shortest ' +
    'prefix reaching a target sum when all values are non-negative.',

  prerequisites: [],
  related: ['difference-arrays', 'frequency-arrays', 'fenwick-tree'],
  combinesWith: ['binary-search', 'frequency-arrays', 'two-pointers'],
  next: ['difference-arrays', 'two-pointers'],
};

const differenceArrays: CtTopic = {
  id: 'difference-arrays',
  title: 'Difference Arrays',
  titleKa: 'სხვაობის მასივები',
  category: 'foundation',
  priority: 'essential',
  order: 2,

  whatIs:
    'The inverse of a prefix sum. To add `v` to every element of `a[l..r]`, you ' +
    'instead do `d[l] += v` and `d[r+1] -= v` on a difference array `d`. After all ' +
    'updates, the prefix sum of `d` reconstructs the final array.',

  intuition:
    'Record only where the running increment *changes*: it turns on at `l` and ' +
    'turns off just past `r`. Sweeping left to right re-accumulates the value.',

  whyItWorks:
    'If `d` is defined so that `a[i] = d[0] + d[1] + ... + d[i]`, then a range ' +
    'update on `a` is a point update on `d`: raising the increment at `l` lifts ' +
    'every later prefix, and lowering it at `r+1` cancels that lift from `r+1` on. ' +
    'Exactly the elements `l..r` keep the change.',

  naive:
    'Applying q range-add updates directly is O(n) each, O(n·q) total — too slow ' +
    'for n, q ~ 2·10^5. The difference array makes each update O(1); one final ' +
    'O(n) prefix-sum pass materialises the array. Total O(n + q).',

  whenToUse: [
    'Many range-add / range-subtract updates, and you only need the array *after* all of them',
    '"Add 1 to every position in [l, r]" repeated — e.g. counting overlapping intervals',
    'Simulating +/- events on a timeline (people entering and leaving, bookings)',
  ],

  signals: [
    '"apply q updates, each adding a value to a contiguous range, then print the array"',
    '"how many intervals cover each point"',
    '"the queries are all updates; there are no reads until the end"',
    'Range updates with only a single final read — no interleaved queries',
  ],

  walkthrough: [
    'n = 5, array starts [0,0,0,0,0]. Updates: add 2 to [1,3], then add 5 to [0,2].',
    'd starts [0,0,0,0,0,0] (length n+1).',
    'Update 1: d[1] += 2, d[4] -= 2  →  d = [0, 2, 0, 0, -2, 0].',
    'Update 2: d[0] += 5, d[3] -= 5  →  d = [5, 2, 0, -5, -2, 0].',
    'Prefix-sum d: [5, 7, 7, 2, 0, ...] — take the first n: a = [5, 7, 7, 2, 0].',
    'Check position 2: covered by both updates, 2 + 5 = 7. Correct.',
  ],

  cpp: [
    {
      caption: 'Range-add updates, one final materialisation',
      code: `#include <bits/stdc++.h>
using namespace std;

int main() {
    int n, q;
    cin >> n >> q;
    vector<long long> d(n + 1, 0);
    while (q--) {
        int l, r; long long v;
        cin >> l >> r >> v;          // add v to a[l..r], inclusive
        d[l] += v;
        d[r + 1] -= v;               // safe: d has size n+1
    }
    long long cur = 0;
    for (int i = 0; i < n; i++) {
        cur += d[i];                 // prefix sum reconstructs a[i]
        cout << cur << " ";
    }
}`,
    },
    {
      caption: '2D difference array — add v to a submatrix in O(1)',
      code: `// stamp the rectangle (r1,c1)-(r2,c2) with +v
d[r1][c1]         += v;
d[r1][c2 + 1]     -= v;
d[r2 + 1][c1]     -= v;
d[r2 + 1][c2 + 1] += v;
// then take a 2D prefix sum of d to get the final grid`,
    },
  ],

  time: 'O(1) per range update, O(n) for the single final pass. Total O(n + q).',
  space: 'O(n) for the difference array (O(n·m) in 2D).',

  mistakes: [
    'Sizing `d` as length n and then writing `d[r+1]` when r = n-1 — out of bounds. Use n+1.',
    'Reading a value mid-stream: the array is only valid after the prefix-sum pass. Interleaved reads need a Fenwick tree.',
    'Forgetting `long long` when many updates stack on one cell.',
    '2D: getting the inclusion–exclusion signs wrong on the four corner stamps.',
  ],

  edgeCases: [
    'r == n-1: the `-v` lands at d[n], which exists only because d has size n+1.',
    'l == r: a single-element update, d[l] += v and d[l+1] -= v.',
    'Overlapping updates: they simply add — no special handling.',
    'v negative: range subtraction, identical mechanics.',
  ],

  exercises: [
    'Given q intervals [l, r], output for each position how many intervals cover it.',
    'Simulate a car-pooling schedule: given (passengers, start, end) trips, does capacity hold at every point?',
    'Apply range updates, then answer a few range-sum queries — combine with prefix sums.',
  ],

  practice: [
    { name: 'CSES — Range Update Queries (offline variant)', tag: 'CSES' },
    { name: 'LeetCode 1109 — Corporate Flight Bookings', tag: 'LC Medium', url: 'https://leetcode.com/problems/corporate-flight-bookings/' },
    { name: 'LeetCode 1094 — Car Pooling', tag: 'LC Medium', url: 'https://leetcode.com/problems/car-pooling/' },
  ],

  combineNote:
    'Difference array in, prefix sum out — they are one technique used in two ' +
    'directions. In 2D, a difference array plus a 2D prefix sum gives O(1) ' +
    'submatrix updates. When reads and updates interleave, this pattern is what ' +
    'a Fenwick tree generalises.',

  prerequisites: ['prefix-sums'],
  related: ['prefix-sums', 'fenwick-tree'],
  combinesWith: ['prefix-sums', 'sorting-techniques'],
  next: ['frequency-arrays', 'fenwick-tree'],
};

const frequencyArrays: CtTopic = {
  id: 'frequency-arrays',
  title: 'Frequency Arrays / Counting',
  titleKa: 'სიხშირის მასივები',
  category: 'foundation',
  priority: 'essential',
  order: 3,

  whatIs:
    'An array `cnt` indexed by *value* rather than position: `cnt[x]` is how many ' +
    'times `x` appears. Building it is one O(n) pass; afterwards any "how many of ' +
    'value x" question is O(1), and a prefix sum over `cnt` answers "how many ' +
    'values ≤ x".',

  intuition:
    'Stop scanning the data to answer questions about it. Bucket each element ' +
    'once, then read the buckets.',

  whyItWorks:
    'Array indexing is O(1). If the value range is small enough to be an index ' +
    '(say 0..10^6), a direct-address table beats a hash map on constant factor ' +
    'and beats sorting on asymptotics for counting tasks. Counting sort and ' +
    'histogram queries are the same idea.',

  naive:
    'Answering "how many elements equal x" or "how many are ≤ x" by scanning is ' +
    'O(n) per query. Sorting first gives O(n log n) then O(log n) per query via ' +
    'binary search. A frequency array gives O(n + V) build (V = value range) and ' +
    'O(1) per query — better when V is not much larger than n.',

  whenToUse: [
    'Values lie in a known, modest range (fits as an array index)',
    'You need counts, "k-th smallest", or "number of values in [lo, hi]" repeatedly',
    'Counting sort: stable sort of small integers in O(n + V)',
    'Character counts (fixed alphabet of 26 or 128)',
  ],

  signals: [
    '"array elements are between 1 and 10^6" — a bounded value range',
    '"count pairs / elements with value equal to ..." ',
    '"how many numbers are less than or equal to x"',
    '"anagram", "permutation", "same multiset" — compare frequency arrays',
  ],

  walkthrough: [
    'a = [2, 5, 2, 1, 5, 2], values in 0..5.',
    'cnt after one pass: cnt[1] = 1, cnt[2] = 3, cnt[5] = 2, rest 0.',
    '"How many 2s?"  → cnt[2] = 3, O(1).',
    'Prefix-sum cnt → pre = [0, 1, 4, 4, 4, 6] (pre[v] = count of values ≤ v).',
    '"How many values ≤ 3?"  → pre[3] = 4.',
    '"3rd smallest element?"  → smallest v with pre[v] ≥ 3 is v = 2 (pre[2] = 4).',
  ],

  cpp: [
    {
      caption: 'Frequency array + prefix counts',
      code: `#include <bits/stdc++.h>
using namespace std;

int main() {
    int n;
    cin >> n;
    const int V = 1000001;              // one past the max value
    vector<int> cnt(V, 0);
    for (int i = 0; i < n; i++) {
        int x; cin >> x;
        cnt[x]++;
    }
    // prefix counts: pre[v] = number of elements <= v
    vector<long long> pre(V, 0);
    pre[0] = cnt[0];
    for (int v = 1; v < V; v++) pre[v] = pre[v - 1] + cnt[v];

    // number of elements in [lo, hi]:
    auto inRange = [&](int lo, int hi) {
        return pre[hi] - (lo > 0 ? pre[lo - 1] : 0);
    };
    (void)inRange;
}`,
    },
    {
      caption: 'Counting sort — stable, O(n + V)',
      code: `vector<int> countingSort(const vector<int>& a, int V) {
    vector<int> cnt(V + 1, 0);
    for (int x : a) cnt[x]++;
    for (int v = 1; v <= V; v++) cnt[v] += cnt[v - 1];   // cnt[v] = final end index
    vector<int> out(a.size());
    for (int i = (int)a.size() - 1; i >= 0; i--)         // reverse pass keeps it stable
        out[--cnt[a[i]]] = a[i];
    return out;
}`,
    },
  ],

  time: 'O(n + V) to build, O(1) per exact-count query, O(1) per range-count after a prefix pass.',
  space: 'O(V) — the value range, not the input size. This is the constraint that decides applicability.',

  mistakes: [
    'Negative or offset values: shift by a constant so the minimum maps to index 0.',
    'V too large to allocate (values up to 10^18) — fall back to a hash map or coordinate compression.',
    'Using `int` for prefix counts when n is large and many elements share a value.',
    'Counting sort: a forward final pass instead of reverse breaks stability.',
  ],

  edgeCases: [
    'A value that never appears: cnt[x] = 0, queries still correct.',
    'All elements equal: cnt has a single non-zero bucket.',
    'x outside [0, V): must be filtered or the index is invalid.',
    'n = 0: cnt is all zeros, every count query returns 0.',
  ],

  exercises: [
    'Check if two strings are anagrams by comparing 26-length frequency arrays.',
    'Given an array with values in [1, 100], answer 10^5 queries of "count of values in [lo, hi]".',
    'Find the smallest missing positive integer using a boolean frequency array.',
  ],

  practice: [
    { name: 'CSES — Distinct Numbers (counting / set)', tag: 'CSES', url: 'https://cses.fi/problemset/task/1621' },
    { name: 'Codeforces 977C — Less or Equal', tag: 'CF 1200', url: 'https://codeforces.com/problemset/problem/977/C' },
    { name: 'LeetCode 242 — Valid Anagram', tag: 'LC Easy', url: 'https://leetcode.com/problems/valid-anagram/' },
  ],

  combineNote:
    'A frequency array *is* a prefix-sum problem waiting to happen: build counts, ' +
    'then prefix them for range/order-statistic queries. When the value range is ' +
    'too big, coordinate compression shrinks it back into an index. Sliding-window ' +
    'problems over a bounded alphabet keep a live frequency array as the window moves.',

  prerequisites: ['prefix-sums'],
  related: ['prefix-sums', 'coordinate-compression', 'sorting-techniques'],
  combinesWith: ['sliding-window', 'prefix-sums', 'two-pointers'],
  next: ['two-pointers', 'sorting-techniques'],
};

const twoPointers: CtTopic = {
  id: 'two-pointers',
  title: 'Two Pointers',
  titleKa: 'ორი მაჩვენებელი',
  category: 'foundation',
  priority: 'essential',
  order: 4,

  whatIs:
    'Two indices that move through a sequence in a coordinated way — often from ' +
    'both ends toward the middle, or both forward at different speeds — so the ' +
    'work is one linear pass instead of a nested loop.',

  intuition:
    'When advancing one pointer can only ever push the other in one direction, ' +
    'you never need to go back. The double loop collapses because most (i, j) ' +
    'pairs can be skipped without checking.',

  whyItWorks:
    'It relies on monotonicity. Example: in a sorted array, if a[i] + a[j] is too ' +
    'large, then pairing a[i] with anything above a[j] is also too large, so move ' +
    'j down; if too small, move i up. Each pointer travels one way only, so the ' +
    'total number of moves is at most 2n even though the pair space is quadratic.',

  naive:
    'Checking all pairs (i, j) to find one with a target property is O(n^2). Two ' +
    'pointers exploit an ordering so that after comparing (i, j) you know which ' +
    'pointer to move, discarding a whole row or column of the pair matrix each ' +
    'step. That drops O(n^2) to O(n) (plus O(n log n) if a sort is needed first).',

  whenToUse: [
    'The array (or the relevant key) is sorted, or can be sorted',
    'Searching for a pair / triple with a sum or difference condition',
    'Merging two sorted sequences',
    'Partitioning in place (Dutch-flag, quicksort partition)',
    'Comparing / matching two sequences (is s a subsequence of t?)',
  ],

  signals: [
    '"sorted array" + "find two elements such that ..."',
    '"pair with sum equal to / closest to target"',
    '"merge", "in place", "without extra space"',
    '"is one string a subsequence of another"',
    'A brute-force pair search where the array happens to be sorted',
  ],

  walkthrough: [
    'Sorted a = [1, 3, 4, 6, 8, 11], target sum = 10.',
    'i = 0 (val 1), j = 5 (val 11). 1 + 11 = 12 > 10 → move j left.',
    'i = 0 (1), j = 4 (8). 1 + 8 = 9 < 10 → move i right.',
    'i = 1 (3), j = 4 (8). 3 + 8 = 11 > 10 → move j left.',
    'i = 1 (3), j = 3 (6). 3 + 6 = 9 < 10 → move i right.',
    'i = 2 (4), j = 3 (6). 4 + 6 = 10 → found. Total pointer moves: 5, not 15 pair checks.',
  ],

  cpp: [
    {
      caption: 'Opposite ends: pair with a given sum in a sorted array',
      code: `#include <bits/stdc++.h>
using namespace std;

int main() {
    int n; long long target;
    cin >> n >> target;
    vector<long long> a(n);
    for (auto& x : a) cin >> x;
    sort(a.begin(), a.end());

    int i = 0, j = n - 1;
    while (i < j) {
        long long s = a[i] + a[j];
        if (s == target) { cout << i << " " << j << "\\n"; return 0; }
        if (s < target) i++;      // need a bigger sum
        else j--;                 // need a smaller sum
    }
    cout << "no pair\\n";
}`,
    },
    {
      caption: 'Same direction: is s a subsequence of t?',
      code: `bool isSubsequence(const string& s, const string& t) {
    int i = 0;                          // pointer into s
    for (int j = 0; j < (int)t.size() && i < (int)s.size(); j++)
        if (t[j] == s[i]) i++;          // matched one char of s
    return i == (int)s.size();
}`,
    },
  ],

  time: 'O(n) for the scan, O(n log n) overall when the input must be sorted first.',
  space: 'O(1) extra — the pointers only. Sorting may add O(log n) stack for the recursion.',

  mistakes: [
    'Using two pointers on unsorted data when the logic needs monotonicity — the answer is silently wrong.',
    'Loop condition `i <= j` when a pair needs two distinct indices — use `i < j`.',
    'Moving both pointers in the same step and skipping the valid pair between them.',
    'Forgetting that after sorting, the returned indices are into the *sorted* array, not the original.',
  ],

  edgeCases: [
    'n < 2: no pair exists — return early.',
    'Duplicate values equal to target/2: make sure `i < j` still allows the pair.',
    'All elements identical: pointers meet in the middle correctly.',
    'Target unreachable: pointers cross, loop exits, report "none".',
  ],

  exercises: [
    'Given a sorted array, count pairs with sum < target in O(n).',
    'Merge two sorted arrays into one without a library merge.',
    'Move all zeros to the end of an array in place, keeping the order of non-zeros.',
    '3-sum: fix one element, two-pointer the rest — O(n^2) total.',
  ],

  practice: [
    { name: 'CSES — Sum of Two Values', tag: 'CSES', url: 'https://cses.fi/problemset/task/1640' },
    { name: 'Codeforces 279B — Books', tag: 'CF 1400', url: 'https://codeforces.com/problemset/problem/279/B' },
    { name: 'LeetCode 15 — 3Sum', tag: 'LC Medium', url: 'https://leetcode.com/problems/3sum/' },
  ],

  combineNote:
    'Two pointers is the parent pattern of the sliding window (both pointers move ' +
    'forward, the window is the gap between them). It pairs with sorting almost ' +
    'always, and with a frequency array when the "condition" is about how many ' +
    'distinct values sit between the pointers. Fixing one index and two-pointering ' +
    'the rest is the standard way to add a dimension (2Sum → 3Sum).',

  prerequisites: ['frequency-arrays'],
  related: ['sliding-window', 'sorting-techniques', 'binary-search'],
  combinesWith: ['sorting-techniques', 'frequency-arrays', 'binary-search'],
  next: ['sliding-window', 'binary-search'],
};

const slidingWindow: CtTopic = {
  id: 'sliding-window',
  title: 'Sliding Window',
  titleKa: 'მოცურავე ფანჯარა',
  category: 'foundation',
  priority: 'essential',
  order: 5,

  whatIs:
    'A contiguous subarray `[l, r]` maintained as `r` advances one step at a time. ' +
    '`l` is pulled forward only as far as needed to keep the window valid. Some ' +
    'aggregate (sum, distinct count, max frequency) is updated incrementally on ' +
    'each move rather than recomputed.',

  intuition:
    'The answer for window ending at `r` reuses almost all of the work done for ' +
    '`r - 1`: one element enters on the right, zero or more leave on the left.',

  whyItWorks:
    'For "longest/shortest valid window" problems, validity is monotone in `l`: ' +
    'if `[l, r]` is valid then `[l+1, r]` is too (or the reverse). So `l` never ' +
    'needs to move backward — across the whole run it advances at most n times, ' +
    'and `r` advances exactly n times. O(n) even though the window resizes.',

  naive:
    'Enumerating every subarray and checking it is O(n^2) subarrays × O(n) check ' +
    '= O(n^3), or O(n^2) with a prefix sum. The sliding window keeps a running ' +
    'summary of the current window and slides it, so each element is added once ' +
    'and removed once: O(n) total.',

  whenToUse: [
    '"Longest / shortest / count of contiguous subarrays such that <condition>"',
    'The condition is monotone: growing the window can only make it "more invalid", shrinking "more valid" (or vice versa)',
    'Fixed-size window: "every subarray of length k" — a special, simpler case',
    'All values non-negative (for sum conditions) — negatives break monotonicity, use prefix sum + map instead',
  ],

  signals: [
    '"longest substring / subarray with at most k distinct ..."',
    '"smallest subarray with sum ≥ target"',
    '"maximum sum of any k consecutive elements"',
    '"contiguous" + an aggregate condition + non-negative values',
  ],

  walkthrough: [
    'a = [2, 1, 5, 1, 3, 2], find the shortest subarray with sum ≥ 7.',
    'r = 0: win sum 2. r = 1: 3. r = 2: 8 ≥ 7 → try to shrink: drop a[0]=2 → 6 < 7, stop. best len = 3 ([2,1,5]).',
    'r = 3: sum 6 + 1 = 7 ≥ 7 → shrink: drop a[1]=1 → 6, stop. window [5,1] ... wait sum is 5+1+1=7, drop a[1] gives 5+1+1? re-track: l=1 now, sum a[1..3]=1+5+1=7, drop a[1]=1 → a[2..3]=6 <7 stop. len 3.',
    'r = 4: add 3 → a[2..4] = 5+1+3 = 9 ≥ 7 → shrink: drop a[2]=5 → 4 < 7 stop. len 3.',
    'r = 5: add 2 → a[3..5] = 1+3+2 = 6 < 7. window stays.',
    'Answer: length 3. Each index entered and left the window once.',
  ],

  cpp: [
    {
      caption: 'Variable window: shortest subarray with sum ≥ target',
      code: `#include <bits/stdc++.h>
using namespace std;

int main() {
    int n; long long target;
    cin >> n >> target;
    vector<long long> a(n);
    for (auto& x : a) cin >> x;

    long long sum = 0;
    int l = 0, best = INT_MAX;
    for (int r = 0; r < n; r++) {
        sum += a[r];                       // element enters on the right
        while (sum - a[l] >= target) {     // shrink while still valid
            sum -= a[l];
            l++;
        }
        if (sum >= target) best = min(best, r - l + 1);
    }
    cout << (best == INT_MAX ? -1 : best) << "\\n";
}`,
    },
    {
      caption: 'Variable window: longest substring with at most k distinct characters',
      code: `int longestAtMostKDistinct(const string& s, int k) {
    vector<int> cnt(256, 0);
    int distinct = 0, l = 0, best = 0;
    for (int r = 0; r < (int)s.size(); r++) {
        if (cnt[(unsigned char)s[r]]++ == 0) distinct++;
        while (distinct > k) {                       // window invalid — shrink
            if (--cnt[(unsigned char)s[l]] == 0) distinct--;
            l++;
        }
        best = max(best, r - l + 1);
    }
    return best;
}`,
    },
  ],

  time: 'O(n): every index is added once and removed at most once. O(1) or O(alphabet) per step.',
  space: 'O(1) for a numeric aggregate; O(alphabet) or O(distinct) if a frequency map tracks the window.',

  mistakes: [
    'Using a window when values can be negative — a longer window is no longer guaranteed to have a larger sum. Use prefix sums + a hash map.',
    'Recomputing the aggregate from scratch each step — that is back to O(n^2).',
    'Shrinking with `if` when a single entering element can invalidate the window by more than one — use `while`.',
    'Fixed-size window: forgetting to remove `a[r-k]` when `r ≥ k`.',
    'Off-by-one in the length `r - l + 1`.',
  ],

  edgeCases: [
    'No valid window ever forms — return -1 / 0 as the problem dictates.',
    'The whole array is the answer — `l` never moves.',
    'k = 0 for "at most k distinct" — only empty windows are valid.',
    'Single element ≥ target — window of length 1.',
    'All elements zero with target 0 — the shrink condition must be `>` not `≥` to avoid an empty window, depending on the exact task.',
  ],

  exercises: [
    'Maximum sum of any window of fixed size k.',
    'Longest substring without repeating characters.',
    'Count subarrays with exactly k distinct integers (hint: atMost(k) - atMost(k-1)).',
    'Smallest window in s that contains all characters of t.',
  ],

  practice: [
    { name: 'CSES — Playlist (longest distinct window)', tag: 'CSES', url: 'https://cses.fi/problemset/task/1141' },
    { name: 'Codeforces 1234D — Distinct Characters Queries', tag: 'CF 1600', url: 'https://codeforces.com/problemset/problem/1234/D' },
    { name: 'LeetCode 76 — Minimum Window Substring', tag: 'LC Hard', url: 'https://leetcode.com/problems/minimum-window-substring/' },
  ],

  combineNote:
    'The sliding window is two pointers moving the same direction with the gap as ' +
    'the object of interest. It keeps a live frequency array for alphabet ' +
    'conditions. The "exactly k" trick reduces to two "at most" windows. When the ' +
    'window aggregate is a max/min, a monotonic deque upgrades each step back to ' +
    'amortised O(1).',

  prerequisites: ['two-pointers'],
  related: ['two-pointers', 'frequency-arrays', 'monotonic-queue'],
  combinesWith: ['frequency-arrays', 'prefix-sums', 'monotonic-queue'],
  next: ['binary-search', 'monotonic-queue'],
};

/* ---- roadmap slots: authored later ---- */

const stub = (
  id: string,
  title: string,
  titleKa: string,
  priority: CtTopic['priority'],
  order: number,
  rel: Pick<CtTopic, 'prerequisites' | 'related' | 'combinesWith' | 'next'>,
): CtTopic => ({ id, title, titleKa, category: 'foundation', priority, order, ...rel });

const binarySearch = stub('binary-search', 'Binary Search', 'ბინარული ძებნა', 'essential', 6, {
  prerequisites: ['prefix-sums'],
  related: ['two-pointers', 'binary-search-on-answer', 'sparse-table'],
  combinesWith: ['prefix-sums', 'sorting-techniques'],
  next: ['binary-search-on-answer', 'ternary-search'],
});

const bitManipulation = stub('bit-manipulation', 'Bit Manipulation', 'ბიტ-მანიპულაცია', 'important', 7, {
  prerequisites: [],
  related: ['bitmask-enumeration', 'bitmask-dp'],
  combinesWith: ['bitmask-enumeration', 'bitmask-dp', 'meet-in-the-middle'],
  next: ['bitmask-enumeration'],
});

const recursion = stub('recursion', 'Recursion (multi-branch)', 'რეკურსია', 'essential', 8, {
  prerequisites: [],
  related: ['backtracking', 'dfs', 'dp-fundamentals'],
  combinesWith: ['backtracking', 'memoization-vs-iterative'],
  next: ['backtracking', 'dfs'],
});

export const FOUNDATION_TOPICS: CtTopic[] = [
  prefixSums,
  differenceArrays,
  frequencyArrays,
  twoPointers,
  slidingWindow,
  binarySearch,
  bitManipulation,
  recursion,
];
