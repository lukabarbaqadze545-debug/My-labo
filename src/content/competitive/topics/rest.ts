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
  titleKa: 'დალაგებაზე დაფუძნებული მეთოდები',
  category: 'core',
  priority: 'essential',
  order: 1,

  whatIs:
    'არა „როგორ დავახარისხოთ" — ამას `sort()` აკეთებს — არამედ მეტა-ნაბიჯი: ' +
    'დაალაგე მონაცემი (ან ასლი, ან ინდექსების სია) არჩეული გასაღებით ისე, რომ ' +
    'დალაგების თვისებამ ამოცანის დანარჩენი ნაწილი წრფივი ან მარტივი გახადოს.',

  intuition:
    'ბევრი ამოცანა რთულია მხოლოდ იმიტომ, რომ შესატანი თვითნებურ რიგშია. დააწესე ' +
    'რიგი, რომელიც შესადარებელ ელემენტებს გვერდიგვერდ აყენებს, და ჩადგმული ' +
    'ციკლი ერთ გავლად იქცევა.',

  whyItWorks:
    'დახარისხების შემდეგ „მომდევნო რელევანტური ელემენტი" ყოველთვის მეზობელია ან ' +
    'მონოტონური მაჩვენებლით მიღწევადი. დახარისხება ჯდება `O(n log n)` ერთხელ და ' +
    'ყიდულობს `O(n)` ან `O(n log n)`-ს მთავარი ლოგიკისთვის `O(n^2)`-ის ნაცვლად. ' +
    'ოსტატობა გასაღების არჩევაშია — მნიშვნელობით, წყვილით, დაწყების დროით, ' +
    'ხელით დაწერილი კომპარატორით.',

  naive:
    'ყველა წყვილის შედარება ორი უახლოესი რიცხვის საპოვნელად, ან თითო ინტერვალის ' +
    'შემოწმება ყველა სხვასთან გადაფარვაზე, `O(n^2)`-ია. დაახარისხე სწორი გასაღებით ' +
    'და პასუხი მეზობელ ელემენტებს შორისაა, ან ერთი მარცხნიდან-მარჯვნივ გავლიდან ' +
    'გამოდის მიმდინარე მდგომარეობით: `O(n log n)`, სადაც დახარისხება დომინირებს.',

  whenToUse: [
    '„უახლოესი წყვილი", „მინიმალური სხვაობა", „k-ური უმცირესი" — დაახარისხე, მერე მეზობელი ან ინდექსირებული',
    'ინტერვალები — დაახარისხე დაწყებით, ან დასრულებით ხარბი ალგორითმისთვის',
    '„დააწყვილე / განაწილე ხარბად" — დაახარისხე ორივე მხარე და ერთად გაატარე',
    'Offline მოთხოვნები — დაახარისხე მოთხოვნები ხელსაყრელ დამუშავების რიგში',
    'დახარისხება ხელით გასაღებით: (ვადა, მერე ჯარიმა), (ფარდობა), (დასრულების დრო)',
  ],

  signals: [
    '„მინიმალური / მაქსიმალური სხვაობა ნებისმიერ ორს შორის", „უახლოესი"',
    '„ინტერვალები", „სეგმენტები", „შეხვედრები", „დიაპაზონები", რომლებსაც დაწყვილება ან გადაფარვის დათვლა სჭირდება',
    '„მოთხოვნებზე ნებისმიერი რიგით შეიძლება პასუხი" (offline)',
    'O(n^2) წყვილთა შედარება, რომელსაც ერთგანზომილებიანი რიგი მეზობლად აქცევდა',
    '„დაახარისხე ... -ის მიხედვით" ხშირად სიტყვასიტყვით editorial-ის პირველი ხაზია',
  ],

  walkthrough: [
    'მინიმალური აბსოლუტური სხვაობა ნებისმიერ ორს შორის a = [8, 1, 5, 12, 3]-ში.',
    'მარტივი: შეამოწმე ყველა 10 წყვილი.',
    'დაახარისხე → [1, 3, 5, 8, 12]. თუ x < y < z, მაშინ y უფრო ახლოსაა ორივესთან, ვიდრე x არის z-თან, ამიტომ უახლოესი წყვილი მეზობელი უნდა იყოს.',
    'მეზობელი სხვაობები: 2, 2, 3, 4 → მინიმუმი 2. ერთი გავლა n−1 წყვილზე.',
  ],

  cpp: [
    {
      caption: 'დაახარისხე, მერე გაასრიალე: გადამფარავი ინტერვალების შერწყმა',
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
    for (auto& [l, r] : merged) cout << l << " " << r << "\\n";
}`,
    },
    {
      caption: 'დაახარისხე ინდექსების მასივი — საწყისი მონაცემი ადგილზე დატოვე',
      code: `vector<int> idx(n);
iota(idx.begin(), idx.end(), 0);              // 0, 1, 2, ...
sort(idx.begin(), idx.end(),
     [&](int i, int j) { return a[i] < a[j]; });  // strict "<", never "<="
// now a[idx[0]] is the smallest, and idx[k] is its original position`,
    },
  ],

  time: 'O(n log n) დახარისხებაზე; ზემოთ მდგომი ტექნიკა ჩვეულებრივ O(n) ან O(n log n)-ია. დახარისხება დომინირებს.',
  space:
    'O(n), თუ ასლს ან ინდექსების მასივს ახარისხებ; O(log n) სტეკი დახარისხებისთვის; ' +
    'O(1) დამატებით, თუ ადგილზე ახარისხებ და მხოლოდ ასრიალებ.',

  mistakes: [
    'მნიშვნელობების დახარისხება, როცა საწყისი ინდექსები გჭირდება — დაახარისხე ინდექსების მასივი, ან `(მნიშვნელობა, ინდექსი)` წყვილები.',
    'კომპარატორი, რომელიც არ არის მკაცრი სუსტი დალაგება — `return a <= b;` აფუჭებს `std::sort`-ს. გამოიყენე მკაცრი `<`.',
    'დახარისხება არასწორი გასაღებით — დაწყებით, როცა ხარბ ალგორითმს დასრულება სჭირდება, ან პირიქით.',
    'Overflow ფარდობის კომპარატორში (`a.x * b.y`) — გადაამრავლე ჯვარედინად `long long`-ში.',
    'იმის დავიწყება, რომ დახარისხება შლის შესატანის რიგს, რომელიც ამოცანის შემდგომ ნაწილს ისევ სჭირდება.',
  ],

  edgeCases: [
    'n ≤ 1 — შესადარებელი არაფერია; დაამუშავე დახარისხების ლოგიკამდე.',
    'ყველა ელემენტი ტოლი — მეზობელი სხვაობები 0-ია; კომპარატორი მკაცრი უნდა დარჩეს.',
    'უკვე დახარისხებული ან შებრუნებულად დახარისხებული — მაინც O(n log n), განსაკუთრებული შემთხვევის გარეშე.',
    'გამეორებული გასაღებები ხელით კომპარატორთან — გადაწყვიტე, ტოლობებს მეორეული გასაღები სჭირდება თუ `stable_sort`.',
  ],

  exercises: [
    'მოცემულ წრფეზე წერტილებზე იპოვე ორი უახლოესი.',
    'შერწყი ინტერვალების სია.',
    'დაახარისხე n ელემენტი მნიშვნელობა/წონა ფარდობით (ფრაქციული knapsack-ის მოსამზადებელი).',
    'დაახარისხე სტრიქონები სიგრძით, ტოლობებზე ლექსიკოგრაფიულად.',
  ],

  practice: [
    { name: 'CSES — Restaurant Customers', tag: 'CSES', url: 'https://cses.fi/problemset/task/1619' },
    { name: 'CSES — Movie Festival', tag: 'CSES', url: 'https://cses.fi/problemset/task/1629' },
    { name: 'Codeforces 489B — BerSU Ball', tag: 'CF 1200', url: 'https://codeforces.com/problemset/problem/489/B' },
  ],

  combineNote:
    'დახარისხება არის ორი მაჩვენებლის მოსამზადებელი (ორივე მაჩვენებელი რიგს ' +
    'ვარაუდობს), binary search-ისა და `lower_bound`-ის (დახარისხებული მასივი ' +
    'სჭირდებათ), და ხარბი ალგორითმის (დაახარისხე გაცვლის არგუმენტის გასაღებით, ' +
    'მერე რიგზე აიღე). coordinate compression არის განსხვავებული მნიშვნელობების ' +
    'დახარისხება და თითოს რანგით ჩანაცვლება. sweep-line ახარისხებს მოვლენებს ' +
    'კოორდინატით და რიგზე ამუშავებს.',

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
    'შეცვალე მნიშვნელობათა სიმრავლე, რომელიც უზარმაზარ დიაპაზონს (10^9 ან 10^18-მდე) ' +
    'ფარავს, მაგრამ მხოლოდ n განსხვავებული ჩანაწერი აქვს, მათი რანგებით 0..k−1. ' +
    'რიგი შენარჩუნებულია, ამიტომ ნებისმიერი რიგზე დაფუძნებული სტრუქტურა ახლა ' +
    'k ზომის მასივში ეტევა.',

  intuition:
    'ფაქტობრივი სიდიდეები იშვიათად აქვს მნიშვნელობა — მხოლოდ შეფარდებით რიგს. ' +
    'ამიტომ მნიშვნელობებს ხელახლა დაარქვი 0, 1, 2, ... დახარისხებული პოზიციით.',

  whyItWorks:
    'დაახარისხე განსხვავებული მნიშვნელობები; მნიშვნელობის რანგი მისი ინდექსია იმ ' +
    'სიაში, ნაპოვნი `lower_bound`-ით `O(log k)`-ში. რანგები ბიექციაა, რომელიც `<`-ს ' +
    'ინახავს, ამიტომ თითო შედარება, თითო „დაითვალე მნიშვნელობები [l, r]-ში", თითო ' +
    'პრეფიქსული სტრუქტურა იძლევა იმავე პასუხს რანგებზე, რასაც საწყისებზე — მაგრამ ' +
    'ახლა ინდექსების სივრცე `k`-ია, არა 10^9.',

  naive:
    'გინდა Fenwick-ის ხე ან სიხშირეთა მასივი, ინდექსირებული მნიშვნელობით, მაგრამ ' +
    'მნიშვნელობები 10^9-ს აღწევს და მასივი ვერ გამოიყოფა. `map` მუშაობს, მაგრამ ' +
    'log ფაქტორსა და მძიმე მუდმივას ამატებს და O(1) პრეფიქსულ ხრიკებს ვერ აკეთებს. ' +
    'შეკუმშვა ინდექსების სივრცეს n-მდე ამცირებს, ამიტომ სწრაფი მასივზე დაფუძნებული ' +
    'სტრუქტურა უცვლელად გამოდგება.',

  whenToUse: [
    'გჭირდება მასივი / Fenwick / segment tree, ინდექსირებული მნიშვნელობით, მაგრამ მნიშვნელობები უზარმაზარია',
    '„დაითვალე ინვერსიები", „თითო ელემენტისთვის დაითვალე მისგან მარჯვნივ პატარა ელემენტები"',
    'მნიშვნელობები უზარმაზარია, მაგრამ მხოლოდ რიგს აქვს მნიშვნელობა — რანგები, მედიანები, „k-ური განსხვავებული"',
    '2D ამოცანები — შეკუმშე თითო ღერძი დამოუკიდებლად',
  ],

  signals: [
    '„მნიშვნელობები 10^9-მდე" (ან 10^18, ან „კოორდინატები") + საჭიროება მათით ინდექსირებისა',
    '„დაითვალე ინვერსიები", „დაითვალე წყვილები (i, j) i < j და a[i] > a[j]"',
    '„რამდენი მნიშვნელობაა x-ზე ნაკლები" ბევრ მოთხოვნაზე, x უზარმაზარი დიაპაზონიდან',
    'Fenwick / segment-tree იდეა, რომელიც ვერ მუშაობს მხოლოდ იმიტომ, რომ მნიშვნელობათა დიაპაზონი ძალიან დიდია',
  ],

  walkthrough: [
    'a = [100, 5, 100, 999999, 5].',
    'განსხვავებული, დახარისხებული: [5, 100, 999999].',
    'rank(5) = 0, rank(100) = 1, rank(999999) = 2, თითო lower_bound-ით.',
    'შეკუმშული მასივი: [1, 0, 1, 2, 0].',
    '3 ზომის Fenwick-ის ხე ახლა თვლის „აქამდე ნანახ მნიშვნელობებს ≤ x" გავლისას — შეუძლებელი ნედლ მნიშვნელობებზე.',
  ],

  cpp: [
    {
      caption: 'თავად შეკუმშვა — გამოსაყენებელი დამხმარე',
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
      caption: 'კანონიკური გამოყენება: ინვერსიების დათვლა (Fenwick-ის ხე ცალკე თემაშია)',
      code: `// bit[] is a Fenwick tree of size k; add(i) and query(i) are its O(log k) ops
long long inversions = 0;
vector<int> r = compress(a, sorted);
for (int i = (int)r.size() - 1; i >= 0; i--) {
    inversions += query(r[i] - 1);   // how many already-seen values are strictly smaller
    add(r[i]);                        // this value is now to the right of everything earlier
}`,
    },
  ],

  time: 'O(n log n) დახარისხებასა და დედუპლიკაციაზე; O(log k) თითო რანგის ძებნაზე. დახარისხება დომინირებს.',
  space: 'O(n) დახარისხებული განსხვავებული სიისა და რანგების მასივისთვის.',

  mistakes: [
    '`sort` `unique`-ის გარეშე — რანგები მაშინ ტოვებს რიცხვებს და შეკუმშულ დიაპაზონს ხვრელები აქვს.',
    'ერთით ცდომა: `lower_bound(...) - begin()` არის რანგი; `upper_bound` ყველაფერს ერთით წეწავს.',
    'რანგის უკან მნიშვნელობაზე დაბრუნება საჭიროა, ხოლო დახარისხებული განსხვავებული სია არ ინახება.',
    'შედარება მოთხოვნის მნიშვნელობასთან, რომელიც საწყის სიმრავლეში არ იყო — ჩასვი მოთხოვნის მნიშვნელობებიც შეკუმშვაში, ან ფრთხილად იმსჯელე „ორ რანგს შორის".',
    'ვარაუდი, რომ შეკუმშვა ხვრელებს ინახავს — „ა[i] + 1 ჩნდება" არ არის „რანგი + 1".',
  ],

  edgeCases: [
    'ყველა მნიშვნელობა ტოლი — ერთი განსხვავებული მნიშვნელობა, თითო რანგი 0, შეკუმშული ზომა 1.',
    'მნიშვნელობები უკვე 0..n−1 — შეკუმშვა იგივეობაა, უვნებელი.',
    'უარყოფითი მნიშვნელობები — დახარისხება უმკლავდება; რანგები 0-იდან რჩება.',
    'მოთხოვნის მნიშვნელობები სიმრავლის გარეთ — წინასწარ გადაწყვიტე, დაამატებ თუ არა მათ.',
    'n = 0 — ცარიელი განსხვავებული სია, სარანგებელი არაფერია.',
  ],

  exercises: [
    'შეკუმშე მასივი და გადაამოწმე, რომ შეფარდებითი რიგი უცვლელია.',
    'დაითვალე ინვერსიები მასივში მნიშვნელობებით 10^9-მდე.',
    'მოცემულ სეგმენტებზე უზარმაზარი ბოლოებით, შეკუმშე ისინი და მონიშნე დაფარული უჯრედები difference array-ში.',
    'თითო ელემენტისთვის, რამდენი განსხვავებული პატარა მნიშვნელობა ჩნდება მამდე.',
  ],

  practice: [
    { name: 'LeetCode 315 — Count of Smaller Numbers After Self', tag: 'LC Hard', url: 'https://leetcode.com/problems/count-of-smaller-numbers-after-self/' },
    { name: 'CSES — Nested Ranges Count', tag: 'CSES', url: 'https://cses.fi/problemset/task/2170' },
    { name: 'Codeforces 1042D — Petya and Array', tag: 'CF 1800', url: 'https://codeforces.com/problemset/problem/1042/D' },
  ],

  combineNote:
    'coordinate compression არის დახარისხება პლუს `lower_bound` — ადაპტერი, ' +
    'რომელიც Fenwick-ის ხეს ან segment tree-ს ამუშავებს, როცა მნიშვნელობათა ' +
    'დიაპაზონი ინდექსად ძალიან დიდია. ეს არის სტანდარტული პირველი ნაბიჯი offline ' +
    'დიაპაზონურ-დათვლის ამოცანებზე, sweep-line-ზე დიდ კოორდინატებზე და 2D ' +
    'ამოცანებზე (შეკუმშე თითო ღერძი). ყველაფერი შემდეგ — prefix sums, difference ' +
    'arrays, BIT — უცვლელია.',

  prerequisites: ['sorting-techniques', 'frequency-arrays'],
  related: ['sorting-techniques', 'binary-search', 'fenwick-tree', 'segment-tree'],
  combinesWith: ['fenwick-tree', 'segment-tree', 'prefix-sums', 'difference-arrays'],
  next: ['fenwick-tree'],
};

export const CORE_TOPICS: CtTopic[] = [
  sortingTechniques,
  coordinateCompression,
  slot('core', 'backtracking', 'Backtracking', 'უკან დაბრუნებით ძიება', 'essential', 3, {
    prerequisites: ['recursion'],
    related: ['bitmask-enumeration', 'dfs', 'constructive'],
    combinesWith: ['bitmask-enumeration', 'meet-in-the-middle'],
    next: ['bitmask-enumeration', 'constructive'],
  }),
  slot('core', 'bitmask-enumeration', 'Bitmask Enumeration', 'ბიტმასკების გადარჩევა', 'important', 4, {
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
  slot('greedy-search', 'greedy', 'Greedy & Exchange Argument', 'ხარბი ალგორითმები და გაცვლის არგუმენტი', 'essential', 1, {
    prerequisites: ['sorting-techniques'],
    related: ['invariants', 'constructive', 'mst'],
    combinesWith: ['sorting-techniques', 'priority-queue'],
    next: ['binary-search-on-answer'],
  }),
  slot('greedy-search', 'binary-search-on-answer', 'Binary Search on Answer', 'პასუხზე ორობითი ძებნა', 'essential', 2, {
    prerequisites: ['binary-search', 'greedy'],
    related: ['ternary-search', 'prefix-sums'],
    combinesWith: ['greedy', 'prefix-sums', 'two-pointers'],
    next: ['ternary-search'],
  }),
  slot('greedy-search', 'ternary-search', 'Ternary Search', 'სამობითი ძებნა', 'advanced', 3, {
    prerequisites: ['binary-search-on-answer'],
    related: ['binary-search'],
    combinesWith: ['binary-search-on-answer'],
    next: ['meet-in-the-middle'],
  }),
  slot('greedy-search', 'meet-in-the-middle', 'Meet in the Middle', 'შუაში შეხვედრის მეთოდი', 'advanced', 4, {
    prerequisites: ['bitmask-enumeration', 'sorting-techniques'],
    related: ['bitmask-dp', 'two-pointers'],
    combinesWith: ['two-pointers', 'binary-search'],
    next: [],
  }),
];

export const GRAPH_TOPICS: CtTopic[] = [
  slot('graphs', 'bfs', 'BFS', 'სიგანეში ძიება', 'essential', 1, {
    prerequisites: ['recursion'],
    related: ['dfs', 'connected-components', '01-bfs'],
    combinesWith: ['connected-components', 'flood-fill'],
    next: ['dfs', 'connected-components'],
  }),
  slot('graphs', 'dfs', 'DFS', 'სიღრმეში ძიება', 'essential', 2, {
    prerequisites: ['recursion'],
    related: ['bfs', 'trees', 'topological-sort'],
    combinesWith: ['connected-components', 'topological-sort', 'tree-dp'],
    next: ['connected-components', 'topological-sort', 'trees'],
  }),
  slot('graphs', 'connected-components', 'Connected Components', 'დაკავშირებული კომპონენტები', 'essential', 3, {
    prerequisites: ['bfs', 'dfs'],
    related: ['dsu', 'flood-fill'],
    combinesWith: ['dsu', 'flood-fill'],
    next: ['flood-fill', 'dsu'],
  }),
  slot('graphs', 'flood-fill', 'Flood Fill', 'არეს შევსება', 'important', 4, {
    prerequisites: ['bfs', 'connected-components'],
    related: ['dfs', 'connected-components'],
    combinesWith: ['connected-components'],
    next: ['dijkstra'],
  }),
  slot('graphs', 'topological-sort', 'Topological Sort', 'ტოპოლოგიური დალაგება', 'essential', 5, {
    prerequisites: ['dfs'],
    related: ['dfs', 'dp-fundamentals'],
    combinesWith: ['dp-fundamentals', 'dfs'],
    next: ['dijkstra'],
  }),
  slot('graphs', 'dijkstra', "Dijkstra's Algorithm", 'დეიქსტრას ალგორითმი', 'essential', 6, {
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
  slot('graphs', 'dsu', 'Disjoint Set Union (DSU)', 'განცალკევებული სიმრავლეების გაერთიანება', 'essential', 9, {
    prerequisites: ['connected-components'],
    related: ['mst', 'connected-components'],
    combinesWith: ['mst', 'sorting-techniques', 'coordinate-compression'],
    next: ['mst'],
  }),
  slot('graphs', 'trees', 'Trees & Tree Traversal', 'ხეები და ხეზე გავლა', 'essential', 10, {
    prerequisites: ['dfs'],
    related: ['tree-dp', 'lca'],
    combinesWith: ['tree-dp', 'lca', 'dfs'],
    next: ['lca', 'tree-dp'],
  }),
  slot('graphs', 'lca', 'Lowest Common Ancestor (LCA)', 'უმცირესი საერთო წინაპარი', 'advanced', 11, {
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
  slot('dp', 'bitmask-dp', 'Bitmask DP', 'ბიტმასკებზე DP', 'advanced', 6, {
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
