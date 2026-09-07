import type { CtCategory, CtPriority } from '@/content/competitive';
import type { CtStatus } from '@/domain/competitive/types';

/** Georgian labels for the Tournament vocabulary. */

export const CT_STATUS_LABEL: Record<CtStatus, string> = {
  'not-started': 'დაუწყებელი',
  learning: 'ვსწავლობ',
  practicing: 'ვვარჯიშობ',
  mastered: 'ათვისებული',
  review: 'გასამეორებელი',
};

export const CT_STATUS_GLYPH: Record<CtStatus, string> = {
  'not-started': '○',
  learning: '◔',
  practicing: '◑',
  mastered: '●',
  review: '⟳',
};

export const CT_PRIORITY_LABEL: Record<CtPriority, string> = {
  essential: 'აუცილებელი',
  important: 'მნიშვნელოვანი',
  advanced: 'გაღრმავებული',
};

/** The eighteen section headings, in page order. */
export const CT_SECTION_LABEL = {
  whatIs: 'რა არის',
  intuition: 'ინტუიცია',
  whyItWorks: 'რატომ მუშაობს',
  whenToUse: 'როდის გამოვიყენოთ',
  signals: 'სად ვცნობთ ამოცანაში',
  naive: 'გულუბრყვილო გადაწყვეტა',
  walkthrough: 'ნაბიჯ-ნაბიჯ მაგალითი',
  cpp: 'C++ იმპლემენტაცია',
  complexity: 'სირთულე',
  mistakes: 'ტიპური შეცდომები',
  edgeCases: 'სასაზღვრო შემთხვევები',
  prerequisites: 'წინაპირობები',
  related: 'მონათესავე თემები',
  combines: 'როგორ ერწყმის სხვა ხრიკებს',
  exercises: 'მინი-სავარჯიშოები',
  practice: 'პრაქტიკული ამოცანები',
  notes: 'პირადი ჩანაწერები',
  status: 'სწავლის სტატუსი',
} as const;

export function ctCategoryKa(labels: Record<CtCategory, { ka: string }>, cat: CtCategory): string {
  return labels[cat].ka;
}

/**
 * Display name for a topic: Georgian first (the app is Georgian-first), with the
 * English technical term kept as `topic.title` for the muted subtitle and for
 * problem-statement recognition.
 */
export function ctName(topic: { title: string; titleKa?: string }): string {
  return topic.titleKa ?? topic.title;
}

/** The English technical term, when it is worth showing alongside the Georgian. */
export function ctEnglish(topic: { title: string; titleKa?: string }): string | null {
  return topic.titleKa && topic.titleKa !== topic.title ? topic.title : null;
}
