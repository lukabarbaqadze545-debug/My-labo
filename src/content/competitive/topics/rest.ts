import type { CtCategory, CtPriority, CtTopic } from '../types';

/**
 * Roadmap slots for every topic not yet authored. Each carries its category,
 * priority, order and its place in the relationship graph — enough to draw the
 * full roadmap and route the "learn next" recommendation. Authoring one means
 * filling in the teaching fields; the entry, route and progress row already work.
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

export const CORE_TOPICS: CtTopic[] = [
  slot('core', 'sorting-techniques', 'Sorting-based Techniques', 'დახარისხების ხრიკები', 'essential', 1, {
    prerequisites: ['two-pointers'],
    related: ['coordinate-compression', 'greedy'],
    combinesWith: ['two-pointers', 'binary-search', 'greedy'],
    next: ['coordinate-compression', 'greedy'],
  }),
  slot('core', 'coordinate-compression', 'Coordinate Compression', 'კოორდინატების შეკუმშვა', 'important', 2, {
    prerequisites: ['sorting-techniques', 'frequency-arrays'],
    related: ['fenwick-tree', 'segment-tree'],
    combinesWith: ['fenwick-tree', 'segment-tree'],
    next: ['fenwick-tree'],
  }),
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
