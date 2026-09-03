/**
 * Periodic table data for the chemistry lab.
 *
 * Atomic masses are the conventional IUPAC standard atomic weights, rounded;
 * for elements with no stable isotope the mass number of the most stable known
 * isotope is given in brackets, as IUPAC does.
 * Source: IUPAC Commission on Isotopic Abundances and Atomic Weights.
 */

export type ElementCategory =
  | 'alkali'
  | 'alkaline'
  | 'transition'
  | 'postTransition'
  | 'metalloid'
  | 'nonmetal'
  | 'halogen'
  | 'noble'
  | 'lanthanide'
  | 'actinide'
  | 'unknown';

export interface ChemElement {
  z: number;
  symbol: string;
  ka: string;
  en: string;
  mass: string;
  category: ElementCategory;
  /** Grid position, 1-18 columns / 1-10 rows (rows 9-10 hold the f-block). */
  col: number;
  row: number;
}

export const ELEMENT_CATEGORY_LABELS: Record<ElementCategory, { ka: string; hue: number }> = {
  alkali: { ka: 'ტუტე ლითონები', hue: 8 },
  alkaline: { ka: 'ტუტემიწა ლითონები', hue: 32 },
  transition: { ka: 'გარდამავალი ლითონები', hue: 200 },
  postTransition: { ka: 'პოსტგარდამავალი ლითონები', hue: 172 },
  metalloid: { ka: 'ნახევრადლითონები', hue: 142 },
  nonmetal: { ka: 'არალითონები', hue: 96 },
  halogen: { ka: 'ჰალოგენები', hue: 52 },
  noble: { ka: 'კეთილშობილი აირები', hue: 268 },
  lanthanide: { ka: 'ლანთანოიდები', hue: 316 },
  actinide: { ka: 'აქტინოიდები', hue: 340 },
  unknown: { ka: 'თვისებები ზუსტად უცნობია', hue: 220 },
};

const E = (
  z: number,
  symbol: string,
  ka: string,
  en: string,
  mass: string,
  category: ElementCategory,
  col: number,
  row: number,
): ChemElement => ({ z, symbol, ka, en, mass, category, col, row });

export const ELEMENTS: ChemElement[] = [
  E(1, 'H', 'წყალბადი', 'Hydrogen', '1.008', 'nonmetal', 1, 1),
  E(2, 'He', 'ჰელიუმი', 'Helium', '4.003', 'noble', 18, 1),
  E(3, 'Li', 'ლითიუმი', 'Lithium', '6.94', 'alkali', 1, 2),
  E(4, 'Be', 'ბერილიუმი', 'Beryllium', '9.012', 'alkaline', 2, 2),
  E(5, 'B', 'ბორი', 'Boron', '10.81', 'metalloid', 13, 2),
  E(6, 'C', 'ნახშირბადი', 'Carbon', '12.011', 'nonmetal', 14, 2),
  E(7, 'N', 'აზოტი', 'Nitrogen', '14.007', 'nonmetal', 15, 2),
  E(8, 'O', 'ჟანგბადი', 'Oxygen', '15.999', 'nonmetal', 16, 2),
  E(9, 'F', 'ფტორი', 'Fluorine', '18.998', 'halogen', 17, 2),
  E(10, 'Ne', 'ნეონი', 'Neon', '20.180', 'noble', 18, 2),
  E(11, 'Na', 'ნატრიუმი', 'Sodium', '22.990', 'alkali', 1, 3),
  E(12, 'Mg', 'მაგნიუმი', 'Magnesium', '24.305', 'alkaline', 2, 3),
  E(13, 'Al', 'ალუმინი', 'Aluminium', '26.982', 'postTransition', 13, 3),
  E(14, 'Si', 'სილიციუმი', 'Silicon', '28.085', 'metalloid', 14, 3),
  E(15, 'P', 'ფოსფორი', 'Phosphorus', '30.974', 'nonmetal', 15, 3),
  E(16, 'S', 'გოგირდი', 'Sulfur', '32.06', 'nonmetal', 16, 3),
  E(17, 'Cl', 'ქლორი', 'Chlorine', '35.45', 'halogen', 17, 3),
  E(18, 'Ar', 'არგონი', 'Argon', '39.95', 'noble', 18, 3),
  E(19, 'K', 'კალიუმი', 'Potassium', '39.098', 'alkali', 1, 4),
  E(20, 'Ca', 'კალციუმი', 'Calcium', '40.078', 'alkaline', 2, 4),
  E(21, 'Sc', 'სკანდიუმი', 'Scandium', '44.956', 'transition', 3, 4),
  E(22, 'Ti', 'ტიტანი', 'Titanium', '47.867', 'transition', 4, 4),
  E(23, 'V', 'ვანადიუმი', 'Vanadium', '50.942', 'transition', 5, 4),
  E(24, 'Cr', 'ქრომი', 'Chromium', '51.996', 'transition', 6, 4),
  E(25, 'Mn', 'მანგანუმი', 'Manganese', '54.938', 'transition', 7, 4),
  E(26, 'Fe', 'რკინა', 'Iron', '55.845', 'transition', 8, 4),
  E(27, 'Co', 'კობალტი', 'Cobalt', '58.933', 'transition', 9, 4),
  E(28, 'Ni', 'ნიკელი', 'Nickel', '58.693', 'transition', 10, 4),
  E(29, 'Cu', 'სპილენძი', 'Copper', '63.546', 'transition', 11, 4),
  E(30, 'Zn', 'თუთია', 'Zinc', '65.38', 'transition', 12, 4),
  E(31, 'Ga', 'გალიუმი', 'Gallium', '69.723', 'postTransition', 13, 4),
  E(32, 'Ge', 'გერმანიუმი', 'Germanium', '72.630', 'metalloid', 14, 4),
  E(33, 'As', 'დარიშხანი', 'Arsenic', '74.922', 'metalloid', 15, 4),
  E(34, 'Se', 'სელენი', 'Selenium', '78.971', 'nonmetal', 16, 4),
  E(35, 'Br', 'ბრომი', 'Bromine', '79.904', 'halogen', 17, 4),
  E(36, 'Kr', 'კრიპტონი', 'Krypton', '83.798', 'noble', 18, 4),
  E(37, 'Rb', 'რუბიდიუმი', 'Rubidium', '85.468', 'alkali', 1, 5),
  E(38, 'Sr', 'სტრონციუმი', 'Strontium', '87.62', 'alkaline', 2, 5),
  E(39, 'Y', 'იტრიუმი', 'Yttrium', '88.906', 'transition', 3, 5),
  E(40, 'Zr', 'ცირკონიუმი', 'Zirconium', '91.224', 'transition', 4, 5),
  E(41, 'Nb', 'ნიობიუმი', 'Niobium', '92.906', 'transition', 5, 5),
  E(42, 'Mo', 'მოლიბდენი', 'Molybdenum', '95.95', 'transition', 6, 5),
  E(43, 'Tc', 'ტექნეციუმი', 'Technetium', '[98]', 'transition', 7, 5),
  E(44, 'Ru', 'რუთენიუმი', 'Ruthenium', '101.07', 'transition', 8, 5),
  E(45, 'Rh', 'როდიუმი', 'Rhodium', '102.91', 'transition', 9, 5),
  E(46, 'Pd', 'პალადიუმი', 'Palladium', '106.42', 'transition', 10, 5),
  E(47, 'Ag', 'ვერცხლი', 'Silver', '107.87', 'transition', 11, 5),
  E(48, 'Cd', 'კადმიუმი', 'Cadmium', '112.41', 'transition', 12, 5),
  E(49, 'In', 'ინდიუმი', 'Indium', '114.82', 'postTransition', 13, 5),
  E(50, 'Sn', 'კალა', 'Tin', '118.71', 'postTransition', 14, 5),
  E(51, 'Sb', 'ანტიმონი', 'Antimony', '121.76', 'metalloid', 15, 5),
  E(52, 'Te', 'ტელური', 'Tellurium', '127.60', 'metalloid', 16, 5),
  E(53, 'I', 'იოდი', 'Iodine', '126.90', 'halogen', 17, 5),
  E(54, 'Xe', 'ქსენონი', 'Xenon', '131.29', 'noble', 18, 5),
  E(55, 'Cs', 'ცეზიუმი', 'Caesium', '132.91', 'alkali', 1, 6),
  E(56, 'Ba', 'ბარიუმი', 'Barium', '137.33', 'alkaline', 2, 6),
  E(57, 'La', 'ლანთანი', 'Lanthanum', '138.91', 'lanthanide', 3, 9),
  E(58, 'Ce', 'ცერიუმი', 'Cerium', '140.12', 'lanthanide', 4, 9),
  E(59, 'Pr', 'პრაზეოდიმი', 'Praseodymium', '140.91', 'lanthanide', 5, 9),
  E(60, 'Nd', 'ნეოდიმი', 'Neodymium', '144.24', 'lanthanide', 6, 9),
  E(61, 'Pm', 'პრომეთიუმი', 'Promethium', '[145]', 'lanthanide', 7, 9),
  E(62, 'Sm', 'სამარიუმი', 'Samarium', '150.36', 'lanthanide', 8, 9),
  E(63, 'Eu', 'ევროპიუმი', 'Europium', '151.96', 'lanthanide', 9, 9),
  E(64, 'Gd', 'გადოლინიუმი', 'Gadolinium', '157.25', 'lanthanide', 10, 9),
  E(65, 'Tb', 'ტერბიუმი', 'Terbium', '158.93', 'lanthanide', 11, 9),
  E(66, 'Dy', 'დისპროზიუმი', 'Dysprosium', '162.50', 'lanthanide', 12, 9),
  E(67, 'Ho', 'ჰოლმიუმი', 'Holmium', '164.93', 'lanthanide', 13, 9),
  E(68, 'Er', 'ერბიუმი', 'Erbium', '167.26', 'lanthanide', 14, 9),
  E(69, 'Tm', 'თულიუმი', 'Thulium', '168.93', 'lanthanide', 15, 9),
  E(70, 'Yb', 'იტერბიუმი', 'Ytterbium', '173.05', 'lanthanide', 16, 9),
  E(71, 'Lu', 'ლუტეციუმი', 'Lutetium', '174.97', 'lanthanide', 17, 9),
  E(72, 'Hf', 'ჰაფნიუმი', 'Hafnium', '178.49', 'transition', 4, 6),
  E(73, 'Ta', 'ტანტალი', 'Tantalum', '180.95', 'transition', 5, 6),
  E(74, 'W', 'ვოლფრამი', 'Tungsten', '183.84', 'transition', 6, 6),
  E(75, 'Re', 'რენიუმი', 'Rhenium', '186.21', 'transition', 7, 6),
  E(76, 'Os', 'ოსმიუმი', 'Osmium', '190.23', 'transition', 8, 6),
  E(77, 'Ir', 'ირიდიუმი', 'Iridium', '192.22', 'transition', 9, 6),
  E(78, 'Pt', 'პლატინა', 'Platinum', '195.08', 'transition', 10, 6),
  E(79, 'Au', 'ოქრო', 'Gold', '196.97', 'transition', 11, 6),
  E(80, 'Hg', 'ვერცხლისწყალი', 'Mercury', '200.59', 'transition', 12, 6),
  E(81, 'Tl', 'თალიუმი', 'Thallium', '204.38', 'postTransition', 13, 6),
  E(82, 'Pb', 'ტყვია', 'Lead', '207.2', 'postTransition', 14, 6),
  E(83, 'Bi', 'ბისმუტი', 'Bismuth', '208.98', 'postTransition', 15, 6),
  E(84, 'Po', 'პოლონიუმი', 'Polonium', '[209]', 'postTransition', 16, 6),
  E(85, 'At', 'ასტატი', 'Astatine', '[210]', 'halogen', 17, 6),
  E(86, 'Rn', 'რადონი', 'Radon', '[222]', 'noble', 18, 6),
  E(87, 'Fr', 'ფრანციუმი', 'Francium', '[223]', 'alkali', 1, 7),
  E(88, 'Ra', 'რადიუმი', 'Radium', '[226]', 'alkaline', 2, 7),
  E(89, 'Ac', 'აქტინიუმი', 'Actinium', '[227]', 'actinide', 3, 10),
  E(90, 'Th', 'თორიუმი', 'Thorium', '232.04', 'actinide', 4, 10),
  E(91, 'Pa', 'პროტაქტინიუმი', 'Protactinium', '231.04', 'actinide', 5, 10),
  E(92, 'U', 'ურანი', 'Uranium', '238.03', 'actinide', 6, 10),
  E(93, 'Np', 'ნეპტუნიუმი', 'Neptunium', '[237]', 'actinide', 7, 10),
  E(94, 'Pu', 'პლუტონიუმი', 'Plutonium', '[244]', 'actinide', 8, 10),
  E(95, 'Am', 'ამერიციუმი', 'Americium', '[243]', 'actinide', 9, 10),
  E(96, 'Cm', 'კიურიუმი', 'Curium', '[247]', 'actinide', 10, 10),
  E(97, 'Bk', 'ბერკლიუმი', 'Berkelium', '[247]', 'actinide', 11, 10),
  E(98, 'Cf', 'კალიფორნიუმი', 'Californium', '[251]', 'actinide', 12, 10),
  E(99, 'Es', 'აინშტაინიუმი', 'Einsteinium', '[252]', 'actinide', 13, 10),
  E(100, 'Fm', 'ფერმიუმი', 'Fermium', '[257]', 'actinide', 14, 10),
  E(101, 'Md', 'მენდელევიუმი', 'Mendelevium', '[258]', 'actinide', 15, 10),
  E(102, 'No', 'ნობელიუმი', 'Nobelium', '[259]', 'actinide', 16, 10),
  E(103, 'Lr', 'ლოურენსიუმი', 'Lawrencium', '[266]', 'actinide', 17, 10),
  E(104, 'Rf', 'რეზერფორდიუმი', 'Rutherfordium', '[267]', 'transition', 4, 7),
  E(105, 'Db', 'დუბნიუმი', 'Dubnium', '[268]', 'transition', 5, 7),
  E(106, 'Sg', 'სიბორგიუმი', 'Seaborgium', '[269]', 'transition', 6, 7),
  E(107, 'Bh', 'ბორიუმი', 'Bohrium', '[270]', 'transition', 7, 7),
  E(108, 'Hs', 'ჰასიუმი', 'Hassium', '[269]', 'transition', 8, 7),
  E(109, 'Mt', 'მაიტნერიუმი', 'Meitnerium', '[278]', 'unknown', 9, 7),
  E(110, 'Ds', 'დარმშტადტიუმი', 'Darmstadtium', '[281]', 'unknown', 10, 7),
  E(111, 'Rg', 'რენტგენიუმი', 'Roentgenium', '[282]', 'unknown', 11, 7),
  E(112, 'Cn', 'კოპერნიციუმი', 'Copernicium', '[285]', 'unknown', 12, 7),
  E(113, 'Nh', 'ნიჰონიუმი', 'Nihonium', '[286]', 'unknown', 13, 7),
  E(114, 'Fl', 'ფლეროვიუმი', 'Flerovium', '[289]', 'unknown', 14, 7),
  E(115, 'Mc', 'მოსკოვიუმი', 'Moscovium', '[290]', 'unknown', 15, 7),
  E(116, 'Lv', 'ლივერმორიუმი', 'Livermorium', '[293]', 'unknown', 16, 7),
  E(117, 'Ts', 'ტენესინი', 'Tennessine', '[294]', 'unknown', 17, 7),
  E(118, 'Og', 'ოგანესონი', 'Oganesson', '[294]', 'unknown', 18, 7),
];

/** Short Georgian notes for elements worth pausing on. */
export const ELEMENT_NOTES: Record<string, string> = {
  H: 'სამყაროში ყველაზე გავრცელებული ელემენტი — ატომების დაახლოებით 90%.',
  He: 'ჯერ მზეზე აღმოაჩინეს (1868), დედამიწაზე კი მხოლოდ 27 წლის შემდეგ.',
  C: 'ოთხი ბმის წარმოქმნის უნარი მას ორგანული ქიმიის — და სიცოცხლის — საფუძვლად აქცევს.',
  N: 'ატმოსფეროს დაახლოებით 78%. მიუხედავად სიუხვისა, მცენარეთა უმეტესობა მას პირდაპირ ვერ ითვისებს.',
  O: 'დედამიწის ქერქის ყველაზე გავრცელებული ელემენტი მასის მიხედვით.',
  Ne: 'ნეონის ნათურაში ის წითელ-ნარინჯისფრად ანათებს — სხვა ფერები სხვა აირებია.',
  Na: 'წყალთან ძალიან აქტიურად რეაგირებს — ამიტომ ბუნებაში სუფთა სახით არ გვხვდება.',
  Si: 'თითქმის მთელი თანამედროვე ელექტრონიკა მასზეა აგებული.',
  Fe: 'ვარსკვლავს რკინაზე მძიმე ელემენტის სინთეზი ენერგიის გამოყოფით აღარ შეუძლია.',
  Cu: 'ერთ-ერთი პირველი ლითონი, რომელსაც ადამიანმა გამოყენება ისწავლა.',
  Ag: 'ყველა ლითონს შორის საუკეთესო ელექტროგამტარია.',
  Au: 'ქიმიურად იმდენად ინერტულია, რომ ათასწლეულების შემდეგაც არ ჟანგდება.',
  Hg: 'ერთადერთი ლითონი, რომელიც ოთახის ტემპერატურაზე თხევადია.',
  U: 'ბუნებრივი ურანის მხოლოდ დაახლოებით 0.7%-ია იზოტოპი U-235.',
  Cs: 'წამის განსაზღვრება ცეზიუმ-133-ის გამოსხივების სიხშირეს ეყრდნობა.',
  W: 'ყველა ლითონს შორის ყველაზე მაღალი დნობის ტემპერატურა — 3422 °C.',
  Og: 'ყველაზე მძიმე ცნობილი ელემენტი. მისი ატომები წამის მცირე ნაწილს ცოცხლობენ.',
  Tc: 'პირველი ხელოვნურად მიღებული ელემენტი — სახელიც აქედან მოდის.',
};
