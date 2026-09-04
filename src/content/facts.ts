import type { Fact, SourceRef } from './schema';

/**
 * Facts are held to a higher bar than "fun facts": each one has to teach an
 * idea, and each carries a real, checkable source. Anything we could not
 * attribute to a reputable publisher simply is not in this file.
 */

const SRC = {
  nasa: (path: string, label: string): SourceRef => ({
    label,
    publisher: 'NASA',
    url: `https://science.nasa.gov/${path}`,
    kind: 'institution',
  }),
  esa: (label: string, url: string): SourceRef => ({ label, publisher: 'ESA', url, kind: 'institution' }),
  nist: (label: string): SourceRef => ({
    label,
    publisher: 'NIST',
    url: 'https://physics.nist.gov/cuu/Constants/',
    kind: 'institution',
  }),
  britannica: (label: string, url: string): SourceRef => ({
    label,
    publisher: 'Encyclopædia Britannica',
    url,
    kind: 'encyclopedia',
  }),
  nature: (label: string, url: string, year: number): SourceRef => ({
    label,
    publisher: 'Nature',
    url,
    year,
    kind: 'journal',
  }),
  nih: (label: string, url: string): SourceRef => ({ label, publisher: 'NIH / NLM', url, kind: 'institution' }),
  noaa: (label: string, url: string): SourceRef => ({ label, publisher: 'NOAA', url, kind: 'institution' }),
  usgs: (label: string, url: string): SourceRef => ({ label, publisher: 'USGS', url, kind: 'institution' }),
  cern: (label: string, url: string): SourceRef => ({ label, publisher: 'CERN', url, kind: 'institution' }),
  smithsonian: (label: string, url: string): SourceRef => ({
    label,
    publisher: 'Smithsonian Institution',
    url,
    kind: 'museum',
  }),
  bipm: (label: string): SourceRef => ({
    label,
    publisher: 'BIPM',
    url: 'https://www.bipm.org/en/measurement-units',
    kind: 'institution',
  }),
};

export const FACTS: Fact[] = [
  /* ---------------- ასტრონომია ---------------- */
  {
    id: 'f-light-delay-sun',
    subjectId: 'astronomy',
    text: {
      ka: 'მზის შუქს დედამიწამდე მოსასვლელად დაახლოებით 8 წუთი და 20 წამი სჭირდება. ანუ მზეს ყოველთვის ისეთს ვხედავთ, როგორიც წარსულში იყო.',
    },
    why: {
      ka: 'ეს მხოლოდ საინტერესო რიცხვი არ არის: სინათლის სასრული სიჩქარე ნიშნავს, რომ ცაში ყურება ყოველთვის წარსულში ყურებაა. რაც უფრო შორსაა ობიექტი, მით უფრო ძველია სურათი.',
    },
    difficulty: 1,
    topicIds: ['light', 'stars'],
    source: SRC.nasa('sun/', 'Sun — NASA Science'),
    tags: ['სინათლე', 'მზე'],
  },
  {
    id: 'f-neutron-star-density',
    subjectId: 'astronomy',
    text: {
      ka: 'ნეიტრონული ვარსკვლავის ნივთიერების ერთი ჩაის კოვზი დედამიწაზე დაახლოებით მილიარდ ტონას იწონიდა.',
    },
    why: {
      ka: 'ატომი თითქმის მთლიანად ცარიელი სივრცეა. ნეიტრონულ ვარსკვლავში გრავიტაციამ ეს სიცარიელე გააქრო და მატერია ატომბირთვის სიმკვრივემდე შეკუმშა.',
    },
    difficulty: 3,
    topicIds: ['stars', 'black-holes'],
    source: SRC.nasa('universe/neutron-stars/', 'Neutron Stars — NASA Science'),
  },
  {
    id: 'f-moon-receding',
    subjectId: 'astronomy',
    text: {
      ka: 'მთვარე დედამიწას წელიწადში დაახლოებით 3.8 სანტიმეტრით შორდება. ეს ზუსტად იზომება 1969 წლიდან, აპოლონის მისიების მიერ დატოვებული სარკეებით.',
    },
    why: {
      ka: 'მიზეზი მოქცევებია: დედამიწის ბრუნვა ნელდება და დაკარგული ბრუნვის მომენტი მთვარეს გადაეცემა, რომელიც ორბიტას იმატებს. ეს იმპულსის მუდმივობის კანონის ცოცხალი მაგალითია.',
    },
    difficulty: 3,
    topicIds: ['gravity'],
    source: SRC.nasa('moon/', 'Earth’s Moon — NASA Science'),
  },
  {
    id: 'f-venus-day',
    subjectId: 'astronomy',
    text: {
      ka: 'ვენერაზე ერთი დღე უფრო გრძელია, ვიდრე ერთი წელი: ღერძის გარშემო ის დაახლოებით 243 დედამიწისეულ დღეში შემობრუნდება, მზის გარშემო კი — 225-ში.',
    },
    why: {
      ka: 'გარდა ამისა, ვენერა საპირისპირო მიმართულებით ბრუნავს. ეს გვახსენებს, რომ „დღე" და „წელი" ორი სრულიად დამოუკიდებელი მოძრაობაა.',
    },
    difficulty: 2,
    source: SRC.nasa('venus/', 'Venus — NASA Science'),
  },
  {
    id: 'f-voyager-distance',
    subjectId: 'astronomy',
    text: {
      ka: '1977 წელს გაშვებული „ვოიაჯერ 1" ადამიანის მიერ შექმნილი ყველაზე შორეული ობიექტია — ის უკვე ვარსკვლავთშორის სივრცეშია და დედამიწას სიგნალის მოსვლას 20 საათზე მეტი სჭირდება.',
    },
    why: {
      ka: 'მისი კომპიუტერის მეხსიერება თანამედროვე ტელეფონზე მილიონობითჯერ მცირეა. კარგად გააზრებული ინჟინერია ხშირად უფრო მნიშვნელოვანია, ვიდრე რესურსის რაოდენობა.',
    },
    difficulty: 2,
    source: SRC.nasa('mission/voyager/', 'Voyager — NASA Science'),
  },
  {
    id: 'f-blackhole-image',
    subjectId: 'astronomy',
    text: {
      ka: 'შავი ხვრელის პირველი გამოსახულება 2019 წელს გამოქვეყნდა — M87 გალაქტიკის ცენტრში. მისი მისაღებად რვა ტელესკოპი მთელი დედამიწიდან ერთ ვირტუალურ ტელესკოპად გააერთიანეს.',
    },
    why: {
      ka: 'ერთი ტელესკოპი ამას ვერასოდეს შეძლებდა. მეთოდი, სახელად ინტერფერომეტრია, დედამიწის ზომის ანტენას ბაძავს — და სწორედ ეს გახდა გადამწყვეტი.',
    },
    difficulty: 3,
    topicIds: ['black-holes'],
    source: {
      label: 'Astrophysical Journal Letters 875, L1: First M87 EHT Results',
      publisher: 'Event Horizon Telescope Collaboration',
      url: 'https://iopscience.iop.org/article/10.3847/2041-8213/ab0ec7',
      year: 2019,
      kind: 'journal',
    },
  },
  {
    id: 'f-jwst-infrared',
    subjectId: 'astronomy',
    text: {
      ka: 'ჯეიმზ ვების ტელესკოპი ინფრაწითელ დიაპაზონში ხედავს და მუშაობისთვის დაახლოებით −233 °C-მდე უნდა გაცივდეს. ამისთვის მას ტენისის კორტის ზომის მზისგან დამცავი ეკრანი აქვს.',
    },
    why: {
      ka: 'თბილი ობიექტი თვითონ ასხივებს ინფრაწითელს. ტელესკოპი რომ არ გაცივდეს, საკუთარი სითბოთი დაიბრმავებდა თავს — ეს კარგი მაგალითია იმისა, როგორ განსაზღვრავს ფიზიკა ინჟინერიას.',
    },
    difficulty: 3,
    source: SRC.nasa('mission/webb/', 'James Webb Space Telescope — NASA Science'),
  },
  {
    id: 'f-saturn-density',
    subjectId: 'astronomy',
    text: {
      ka: 'სატურნის საშუალო სიმკვრივე წყლისაზე ნაკლებია — თუ საკმარისად დიდი ოკეანე მოიძებნებოდა, ის ზედაპირზე ამოტივტივდებოდა.',
    },
    why: {
      ka: 'სატურნი ძირითადად წყალბადისა და ჰელიუმისგან შედგება. ეს გვახსენებს, რომ დიდი ზომა და დიდი სიმკვრივე სულ სხვადასხვა რამაა.',
    },
    difficulty: 2,
    source: SRC.nasa('saturn/', 'Saturn — NASA Science'),
  },

  /* ---------------- ფიზიკა ---------------- */
  {
    id: 'f-second-definition',
    subjectId: 'physics',
    text: {
      ka: 'ერთი წამი განისაზღვრება ცეზიუმ-133-ის ატომის გამოსხივების ზუსტად 9 192 631 770 პერიოდით — და არა დედამიწის ბრუნვით.',
    },
    why: {
      ka: 'დედამიწის ბრუნვა არათანაბარია, ატომი კი ყველგან ერთნაირად იქცევა. თანამედროვე მეტროლოგიის იდეა სწორედ ესაა: ერთეულები ბუნების მუდმივებს დავაბათ, არა კონკრეტულ საგანს.',
    },
    difficulty: 3,
    source: SRC.bipm('SI Brochure: The International System of Units'),
  },
  {
    id: 'f-kg-redefinition',
    subjectId: 'physics',
    text: {
      ka: '2019 წლამდე კილოგრამი პარიზთან შენახული ერთადერთი ლითონის ცილინდრით განისაზღვრებოდა. ახლა ის პლანკის მუდმივაზეა დაფუძნებული.',
    },
    why: {
      ka: 'ეტალონის მასა ათწლეულების განმავლობაში ოდნავ იცვლებოდა — ანუ „კილოგრამი" თვითონ იცვლებოდა. ფუნდამენტურ მუდმივაზე გადასვლამ ეს პრობლემა სამუდამოდ მოხსნა.',
    },
    difficulty: 3,
    source: SRC.bipm('Revision of the SI, 2019'),
  },
  {
    id: 'f-higgs',
    subjectId: 'physics',
    text: {
      ka: 'ჰიგსის ბოზონი 2012 წელს აღმოაჩინეს CERN-ის დიდ ადრონულ კოლაიდერზე — თეორიულად ნაწინასწარმეტყველებიდან თითქმის 50 წლის შემდეგ.',
    },
    why: {
      ka: 'ეს იმის მაგალითია, როგორ მუშაობს მეცნიერება: თეორია ჯერ კონკრეტულ, შესამოწმებელ წინასწარმეტყველებას აკეთებს, შემდეგ კი ექსპერიმენტი ათწლეულებს ხარჯავს მის შესამოწმებლად.',
    },
    difficulty: 4,
    topicIds: ['quantum'],
    source: SRC.cern('The Higgs boson', 'https://home.cern/science/physics/higgs-boson'),
  },
  {
    id: 'f-superconductor',
    subjectId: 'physics',
    text: {
      ka: 'ზეგამტარში ელექტრული წინაღობა ზუსტად ნულია — დენს, რომელიც ერთხელ დაიწყო, თეორიულად სამუდამოდ შეუძლია დინება.',
    },
    why: {
      ka: 'ეს ჩვეულებრივი „ძალიან კარგი გამტარი" არ არის: ეს კვანტური მოვლენაა. სწორედ ზეგამტარ მაგნიტებზე მუშაობს MRI აპარატი და დიდი ადრონული კოლაიდერი.',
    },
    difficulty: 4,
    source: SRC.cern('Superconductivity at CERN', 'https://home.cern/science/engineering/superconductivity'),
  },
  {
    id: 'f-static-friction',
    subjectId: 'physics',
    text: {
      ka: 'უძრაობის ხახუნის ძალა ჩვეულებრივ მეტია, ვიდრე მოძრაობის ხახუნისა — ამიტომ არის მძიმე ავეჯის დაძვრა უფრო რთული, ვიდრე შემდეგ მისი ბიძგება.',
    },
    why: {
      ka: 'ეს ყოველდღიური დაკვირვება პირდაპირ ჩანს ფიზიკის ამოცანებში: ერთი და იმავე სხეულისთვის ორი განსხვავებული კოეფიციენტი გვჭირდება.',
    },
    difficulty: 2,
    topicIds: ['newton-laws'],
    source: SRC.britannica('Friction', 'https://www.britannica.com/science/friction'),
  },

  /* ---------------- ქიმია ---------------- */
  {
    id: 'f-water-anomaly',
    subjectId: 'chemistry',
    text: {
      ka: 'წყალი გაყინვისას ფართოვდება — თითქმის ყველა სხვა ნივთიერება კი პირიქით, იკუმშება. სწორედ ამიტომ ტივტივებს ყინული.',
    },
    why: {
      ka: 'მიზეზი წყალბადური ბმებია, რომლებიც ყინულში ღია, ექვსკუთხა სტრუქტურას ქმნიან. ეს ერთი ანომალია ცხოვრებისთვის გადამწყვეტია: ტბები ზემოდან იყინება და ფსკერზე სიცოცხლე გრძელდება.',
    },
    difficulty: 2,
    topicIds: ['water', 'chemical-bonds'],
    source: SRC.britannica('Water — physical properties', 'https://www.britannica.com/science/water'),
  },
  {
    id: 'f-diamond-graphite',
    subjectId: 'chemistry',
    text: {
      ka: 'ალმასი და გრაფიტი ერთი და იმავე ელემენტისგან — ნახშირბადისგან — შედგება. მთელი განსხვავება ატომების განლაგებაშია.',
    },
    why: {
      ka: 'აქედან ჩანს ქიმიის ერთ-ერთი მთავარი იდეა: თვისებებს განსაზღვრავს არა მხოლოდ ის, *რა* ატომებია, არამედ ის, *როგორ* არიან ისინი ერთმანეთთან დაკავშირებული.',
    },
    difficulty: 2,
    topicIds: ['chemical-bonds', 'periodic-table'],
    source: SRC.smithsonian('Carbon minerals', 'https://naturalhistory.si.edu/education/teaching-resources/earth-science'),
  },
  {
    id: 'f-helium-discovery',
    subjectId: 'chemistry',
    text: {
      ka: 'ჰელიუმი ჯერ მზეზე აღმოაჩინეს და მხოლოდ 27 წლის შემდეგ — დედამიწაზე. 1868 წელს მზის დაბნელებისას სპექტრში უცნობი ხაზი შენიშნეს.',
    },
    why: {
      ka: 'სპექტროსკოპია საშუალებას გვაძლევს, შევიტყოთ, რისგან შედგება ობიექტი, რომელსაც ვერასოდეს შევეხებით. დღეს ზუსტად ასევე ვსწავლობთ სხვა პლანეტების ატმოსფეროს.',
    },
    difficulty: 3,
    topicIds: ['periodic-table', 'light'],
    source: SRC.britannica('Helium', 'https://www.britannica.com/science/helium-chemical-element'),
  },
  {
    id: 'f-noble-gases',
    subjectId: 'chemistry',
    text: {
      ka: 'კეთილშობილი აირები თითქმის არავითარ რეაქციაში არ შედიან, რადგან მათი გარე ელექტრონული გარსი უკვე სავსეა.',
    },
    why: {
      ka: 'პერიოდული სისტემის მთელი ლოგიკა სწორედ აქ ჩანს: ქიმიურ ქცევას განსაზღვრავს გარე ელექტრონების რაოდენობა, არა ატომის მასა.',
    },
    difficulty: 2,
    topicIds: ['periodic-table'],
    source: SRC.britannica('Noble gas', 'https://www.britannica.com/science/noble-gas'),
  },
  {
    id: 'f-mendeleev-prediction',
    subjectId: 'chemistry',
    text: {
      ka: 'მენდელეევმა 1869 წელს ცხრილში ცარიელი უჯრები დატოვა და ჯერ აღმოუჩენელი ელემენტების თვისებები იწინასწარმეტყველა. გალიუმი, სკანდიუმი და გერმანიუმი მართლაც ისეთები აღმოჩნდნენ, როგორსაც ის ელოდა.',
    },
    why: {
      ka: 'ეს არის განსხვავება კლასიფიკაციასა და ნამდვილ თეორიას შორის: თეორია ისეთ რამეს წინასწარმეტყველებს, რაც ჯერ არავის უნახავს.',
    },
    difficulty: 2,
    topicIds: ['periodic-table'],
    source: SRC.britannica('Periodic table', 'https://www.britannica.com/science/periodic-table'),
  },

  /* ---------------- ბიოლოგია ---------------- */
  {
    id: 'f-dna-length',
    subjectId: 'biology',
    text: {
      ka: 'ერთი ადამიანის უჯრედში მოთავსებული დნმ გაშლილი დაახლოებით 2 მეტრი სიგრძის იქნებოდა — და ის უჯრედის ბირთვში ეტევა, რომლის დიამეტრიც 6 მიკრომეტრზე ნაკლებია.',
    },
    why: {
      ka: 'ეს შესაძლებელია მრავალდონიანი დახვევის წყალობით. სწორედ ამ შეფუთვის დონე განსაზღვრავს, რომელი გენი იქნება „ჩართული" კონკრეტულ უჯრედში.',
    },
    difficulty: 3,
    topicIds: ['dna', 'cells'],
    source: SRC.nih('What is DNA? — MedlinePlus Genetics', 'https://medlineplus.gov/genetics/understanding/basics/dna/'),
  },
  {
    id: 'f-mitochondria-dna',
    subjectId: 'biology',
    text: {
      ka: 'მიტოქონდრიას საკუთარი, ბირთვისგან დამოუკიდებელი დნმ აქვს და ის თითქმის ყოველთვის მხოლოდ დედისგან გადმოგვდის.',
    },
    why: {
      ka: 'ეს ენდოსიმბიოზის თეორიის მთავარი მტკიცებულებაა: მიტოქონდრია ოდესღაც დამოუკიდებელი ბაქტერია იყო, რომელიც სხვა უჯრედში დასახლდა. ამიტომ შეიძლება დედის ხაზის ევოლუციური კვალის თვალის მიდევნება.',
    },
    difficulty: 3,
    topicIds: ['cells', 'evolution', 'dna'],
    source: SRC.nih('Mitochondrial DNA — MedlinePlus Genetics', 'https://medlineplus.gov/genetics/understanding/mitochondrialdna/'),
  },
  {
    id: 'f-human-microbiome',
    subjectId: 'biology',
    text: {
      ka: 'ადამიანის სხეულში ბაქტერიული უჯრედების რაოდენობა დაახლოებით იმდენივეა, რამდენიც საკუთარი უჯრედების — თანაფარდობა დაახლოებით 1:1-ია.',
    },
    why: {
      ka: 'ძველი „10:1" შეფასება 2016 წელს გადაისინჯა უფრო ზუსტი გამოთვლების საფუძველზე. კარგი მაგალითია იმისა, რომ მეცნიერება საკუთარ რიცხვებსაც ასწორებს.',
    },
    difficulty: 3,
    topicIds: ['cells'],
    source: {
      label: 'Sender, Fuchs & Milo, "Revised Estimates for the Number of Human and Bacteria Cells in the Body", PLOS Biology',
      publisher: 'PLOS Biology',
      url: 'https://journals.plos.org/plosbiology/article?id=10.1371/journal.pbio.1002533',
      year: 2016,
      kind: 'journal',
    },
  },
  {
    id: 'f-photosynthesis-oxygen',
    subjectId: 'biology',
    text: {
      ka: 'ატმოსფეროში არსებული ჟანგბადის დიდი ნაწილი ოკეანის ფიტოპლანქტონმა წარმოქმნა, არა ხმელეთის ტყეებმა.',
    },
    why: {
      ka: 'მიკროსკოპული ორგანიზმები ერთეულში ძალიან პატარები არიან, მაგრამ მათი საერთო მასა და გამრავლების სისწრაფე უზარმაზარია. მასშტაბი ბიოლოგიაში ხშირად ინტუიციის საწინააღმდეგოდ მუშაობს.',
    },
    difficulty: 2,
    topicIds: ['photosynthesis', 'ecosystems'],
    source: SRC.noaa('How much oxygen comes from the ocean?', 'https://oceanservice.noaa.gov/facts/ocean-oxygen.html'),
  },
  {
    id: 'f-crispr',
    subjectId: 'biology',
    text: {
      ka: 'CRISPR თავდაპირველად ბაქტერიების იმუნური სისტემაა — ისინი ვირუსების დნმ-ის ნაწილებს ინახავენ, რომ შემდეგში ამოიცნონ და გაანადგურონ.',
    },
    why: {
      ka: 'გენური რედაქტირების ერთ-ერთი ყველაზე მძლავრი ტექნოლოგია ბუნებაში უკვე არსებობდა — მეცნიერებმა ის „ისესხეს". ფუნდამენტური კვლევა ხშირად სწორედ ასე იძლევა შედეგს.',
    },
    difficulty: 4,
    topicIds: ['dna', 'genetics'],
    source: SRC.nih('What are genome editing and CRISPR-Cas9?', 'https://medlineplus.gov/genetics/understanding/therapy/genomeediting/'),
  },
  {
    id: 'f-tardigrade',
    subjectId: 'biology',
    text: {
      ka: 'ტარდიგრადებს („წყლის დათვები") შეუძლიათ კრიპტობიოზში გადასვლა — მდგომარეობა, როცა ნივთიერებათა ცვლა თითქმის სრულად ჩერდება — და ასე გადაიტანონ ვაკუუმი და უკიდურესი ტემპერატურები.',
    },
    why: {
      ka: 'ისინი „უკვდავები" არ არიან: ჩვეულებრივ პირობებში ისინი ადვილად იღუპებიან. საინტერესო სწორედ ის მექანიზმია, რომელიც უჯრედს დროებით „აჩერებს".',
    },
    difficulty: 3,
    source: SRC.smithsonian('Tardigrades', 'https://www.smithsonianmag.com/science-nature/'),
  },
  {
    id: 'f-neuron-count',
    subjectId: 'biology',
    text: {
      ka: 'ადამიანის ტვინში დაახლოებით 86 მილიარდი ნეირონია — ეს რიცხვი 2009 წელს ზუსტი უჯრედული დათვლის მეთოდით დადგინდა და ძველ „100 მილიარდიან" შეფასებას ჩაენაცვლა.',
    },
    why: {
      ka: 'უფრო მნიშვნელოვანი კავშირების რაოდენობაა: ერთ ნეირონს ათასობით სინაფსი აქვს. ტვინის სიმძლავრე რაოდენობაში კი არა, კავშირების სტრუქტურაშია.',
    },
    difficulty: 3,
    topicIds: ['neuroscience'],
    source: {
      label: 'Azevedo et al., "Equal numbers of neuronal and nonneuronal cells", J. Comparative Neurology',
      publisher: 'Journal of Comparative Neurology',
      url: 'https://onlinelibrary.wiley.com/doi/10.1002/cne.21974',
      year: 2009,
      kind: 'journal',
    },
  },
  {
    id: 'f-dinosaur-color',
    subjectId: 'biology',
    text: {
      ka: 'ზოგიერთი დინოზავრის ფერი ნამდვილად ვიცით: გაქვავებულ ბუმბულში შემორჩენილია მელანოსომები — პიგმენტის შემცველი სტრუქტურები, რომელთა ფორმაც ფერზე მიგვითითებს.',
    },
    why: {
      ka: 'ეს კარგი პასუხია კითხვაზე „საიდან ვიცით?". მეცნიერება პირდაპირ დაკვირვებას კი არა, მტკიცებულებათა ჯაჭვს ეყრდნობა — თანამედროვე ფრინველების მელანოსომებთან შედარებით.',
    },
    difficulty: 3,
    topicIds: ['evolution'],
    source: SRC.nature(
      'Zhang et al., "Fossilized melanosomes and the colour of Cretaceous dinosaurs and birds"',
      'https://www.nature.com/articles/nature08740',
      2010,
    ),
  },

  /* ---------------- მათემატიკა ---------------- */
  {
    id: 'f-infinity-sizes',
    subjectId: 'math',
    text: {
      ka: 'უსასრულობები სხვადასხვა ზომისაა. კანტორმა დაამტკიცა, რომ ნამდვილი რიცხვები „მეტია", ვიდრე ნატურალური რიცხვები — მიუხედავად იმისა, რომ ორივე უსასრულოა.',
    },
    why: {
      ka: 'დამტკიცების იდეა — დიაგონალური მეთოდი — გასაოცრად მარტივია: რა სიაც არ უნდა შეადგინო, ყოველთვის შეიძლება ისეთი რიცხვის აგება, რომელიც სიაში არ არის.',
    },
    difficulty: 4,
    topicIds: ['infinity'],
    source: SRC.britannica('Cantor’s theorem', 'https://www.britannica.com/science/Cantors-theorem'),
  },
  {
    id: 'f-birthday-paradox',
    subjectId: 'probability',
    text: {
      ka: '23 შემთხვევით შერჩეულ ადამიანს შორის ორის დაბადების დღე ერთსა და იმავე დღეს 50%-ზე მეტი ალბათობით ემთხვევა.',
    },
    why: {
      ka: 'ინტუიცია გვატყუებს, რადგან ვფიქრობთ „ჩემს დაბადების დღეზე". სინამდვილეში ითვლება *ყველა წყვილი* — 23 ადამიანში კი 253 წყვილია.',
    },
    difficulty: 3,
    topicIds: ['probability-basics'],
    source: SRC.britannica('Birthday problem', 'https://www.britannica.com/science/birthday-problem'),
  },
  {
    id: 'f-prime-infinite',
    subjectId: 'math',
    text: {
      ka: 'მარტივი რიცხვები უსასრულოდ ბევრია — ეს ევკლიდემ დაამტკიცა 2300 წელზე მეტი ხნის წინ და დამტკიცება დღემდე უცვლელად გამოიყენება.',
    },
    why: {
      ka: 'დამტკიცება საწინააღმდეგოს დაშვებით მუშაობს: თუ მარტივი რიცხვები სასრულია, მათი ნამრავლს დამატებული ერთი ახალ მარტივ გამყოფს გვაძლევს. მათემატიკური ჭეშმარიტება არ „ძველდება".',
    },
    difficulty: 3,
    topicIds: ['prime-numbers'],
    source: SRC.britannica('Prime number', 'https://www.britannica.com/science/prime-number'),
  },
  {
    id: 'f-pi-irrational',
    subjectId: 'math',
    text: {
      ka: 'π ირაციონალურია — მისი ათწილადი წარმოდგენა არასოდეს მთავრდება და არასოდეს მეორდება პერიოდულად. ეს 1761 წელს ლამბერტმა დაამტკიცა.',
    },
    why: {
      ka: 'ანუ π-ს ვერასოდეს ჩავწერთ ორი მთელი რიცხვის შეფარდებად. ეს იმას ნიშნავს, რომ სრულყოფილი წრე და მთელი რიცხვები ერთმანეთს ფუნდამენტურად „ვერ ეწყობიან".',
    },
    difficulty: 3,
    topicIds: ['pi'],
    source: SRC.britannica('Pi', 'https://www.britannica.com/science/pi-mathematics'),
  },
  {
    id: 'f-monty-hall',
    subjectId: 'probability',
    text: {
      ka: 'მონტი ჰოლის ამოცანაში კარის შეცვლა მოგების შანსს 1/3-დან 2/3-მდე ზრდის — მიუხედავად იმისა, რომ ორი კარი დარჩა.',
    },
    why: {
      ka: 'გასაღები ის არის, რომ წამყვანმა *იცის*, სად არის პრიზი და მისი ქმედება ინფორმაციას ატარებს. ეს ალბათობის ერთ-ერთი ყველაზე ცნობილი გაკვეთილია: მნიშვნელოვანია არა მხოლოდ შედეგი, არამედ ისიც, როგორ მივიღეთ ინფორმაცია.',
    },
    difficulty: 3,
    topicIds: ['probability-basics', 'conditional-probability'],
    source: SRC.britannica('Monty Hall problem', 'https://www.britannica.com/science/Monty-Hall-problem'),
  },
  {
    id: 'f-base-rate',
    subjectId: 'probability',
    text: {
      ka: 'თუ დაავადება 1000 ადამიანიდან 1-ს აქვს და ტესტი 99%-ით ზუსტია, დადებითი ტესტის შემთხვევაში ავადმყოფობის ალბათობა მხოლოდ ≈ 9%-ია.',
    },
    why: {
      ka: 'ცრუ-დადებითები (≈ 10 ჯანმრთელზე) ნამდვილ ავადმყოფებს (≈ 1) რიცხობრივად ჭარბობს. „საბაზისო სიხშირის უგულებელყოფა" ერთ-ერთი ყველაზე ძვირადღირებული შეცდომაა მედიცინაში, სამართალსა და უსაფრთხოებაში.',
    },
    difficulty: 3,
    topicIds: ['conditional-probability'],
    tags: ['ბაიესი', 'ალბათობა'],
    source: SRC.britannica('Bayes’s theorem', 'https://www.britannica.com/topic/Bayess-theorem'),
  },
  {
    id: 'f-gamblers-fallacy',
    subjectId: 'probability',
    text: {
      ka: '1913 წელს მონტე-კარლოს კაზინოში რულეტის ბურთი ზედიზედ 26-ჯერ შავზე დაეცა. მოთამაშეებმა მილიონები დაკარგეს „წითელზე" ფსონებით, დარწმუნებულები, რომ ის „უნდა" მოსულიყო.',
    },
    why: {
      ka: 'რულეტს მეხსიერება არ აქვს — ყოველი სროლა დამოუკიდებელია და შავის ალბათობა უცვლელი რჩება. „მოთამაშის შეცდომა" ერთ-ერთი ყველაზე მდგრადი ცრუ ინტუიციაა.',
    },
    difficulty: 2,
    topicIds: ['expected-value', 'randomness-and-fallacies', 'probability-basics'],
    tags: ['შემთხვევითობა'],
    source: SRC.britannica('Gambler’s fallacy', 'https://www.britannica.com/topic/gamblers-fallacy'),
  },
  {
    id: 'f-regression-mean',
    subjectId: 'probability',
    text: {
      ka: 'ფრენსის გალტონმა XIX საუკუნეში შენიშნა: ძალიან მაღალი მშობლების შვილები ჩვეულებრივ მშობლებზე დაბალია, ძალიან დაბლების — მაღალი. ექსტრემუმს საშუალო მოჰყვება.',
    },
    why: {
      ka: '„რეგრესია საშუალოსკენ" ხსნის მრავალ ცრუ დასკვნას: „წაქებამ ავნო, ლანძღვამ გამოასწორა" ხშირად უბრალოდ ეს სტატისტიკური ეფექტია, არა მიზეზ-შედეგი.',
    },
    difficulty: 3,
    topicIds: ['randomness-and-fallacies', 'statistics-basics'],
    tags: ['სტატისტიკა', 'ცრუ ინტუიცია'],
    source: SRC.britannica('Regression to the mean', 'https://www.britannica.com/science/statistics'),
  },
  {
    id: 'f-benford',
    subjectId: 'probability',
    text: {
      ka: 'რეალურ მონაცემებში (მდინარეთა სიგრძე, ქალაქების მოსახლეობა, ბუღალტრული ჩანაწერები) პირველი ციფრი „1" გვხვდება ≈ 30% შემთხვევაში, „9" კი — მხოლოდ ≈ 5%-ში. ეს ბენფორდის კანონია.',
    },
    why: {
      ka: 'თანაბრად „1"–„9" რომ ყოფილიყო, თითო ≈ 11% იქნებოდა. ეს გადახრა იმდენად საიმედოა, რომ ბენფორდის კანონს საგადასახადო თაღლითობისა და არჩევნების გაყალბების აღმოსაჩენად იყენებენ.',
    },
    difficulty: 3,
    topicIds: ['distributions', 'statistics-basics'],
    tags: ['სტატისტიკა'],
    source: SRC.britannica('Benford’s law', 'https://www.britannica.com/science/Benfords-law'),
  },
  {
    id: 'f-large-numbers',
    subjectId: 'probability',
    text: {
      ka: 'დიდი რიცხვების კანონი ამბობს, რომ ბევრი ცდის საშუალო თეორიულ მნიშვნელობას უახლოვდება — მაგრამ ის *ვერაფერს* ამბობს იმაზე, რა მოხდება შემდეგ ცალკეულ ცდაში.',
    },
    why: {
      ka: 'ეს ორი დებულების აღრევა („საშუალო 50%-ია" და „ახლა შავი უნდა მოვიდეს") სწორედ მოთამაშის შეცდომაა. კანონი მუშაობს უსასრულობაში, არა შემდეგ სროლაზე.',
    },
    difficulty: 2,
    topicIds: ['randomness-and-fallacies', 'expected-value'],
    tags: ['ალბათობა'],
    source: SRC.britannica('Law of large numbers', 'https://www.britannica.com/science/law-of-large-numbers'),
  },

  /* ---------------- კომპიუტერული მეცნიერება ---------------- */
  {
    id: 'f-first-programmer',
    subjectId: 'cs',
    text: {
      ka: 'ადა ლავლეისმა 1843 წელს დაწერა ის, რასაც პირველ კომპიუტერულ ალგორითმად მიიჩნევენ — მანქანისთვის, რომელიც არასოდეს აეწყო.',
    },
    why: {
      ka: 'მთავარი მისი ჩანაწერებში ისაა, რომ მან პირველმა დაინახა: მანქანას შეუძლია არა მხოლოდ რიცხვების დათვლა, არამედ ნებისმიერი სიმბოლოს დამუშავება. ეს დღევანდელი კომპიუტერის იდეაა.',
    },
    difficulty: 2,
    topicIds: ['computing-history'],
    source: SRC.britannica('Ada Lovelace', 'https://www.britannica.com/biography/Ada-Lovelace'),
  },
  {
    id: 'f-halting-problem',
    subjectId: 'cs',
    text: {
      ka: 'არსებობს ამოცანები, რომელთა ამოხსნაც კომპიუტერს პრინციპულად არ შეუძლია. ტიურინგმა 1936 წელს დაამტკიცა, რომ შეუძლებელია პროგრამა, რომელიც ნებისმიერი სხვა პროგრამისთვის იტყვის, გაჩერდება ის თუ სამუდამოდ იმუშავებს.',
    },
    why: {
      ka: 'ეს არ არის ტექნიკის სისუსტე — ეს ლოგიკური ზღვარია. რაც არ უნდა სწრაფი გახდეს კომპიუტერი, ეს ამოცანა უამოხსნელი დარჩება.',
    },
    difficulty: 4,
    topicIds: ['computability', 'algorithm-complexity'],
    source: SRC.britannica('Halting problem', 'https://www.britannica.com/topic/halting-problem'),
  },
  {
    id: 'f-first-bug',
    subjectId: 'cs',
    text: {
      ka: '1947 წელს Harvard Mark II-ის ჟურნალში ჩაწერილია ნამდვილი ჩრჩილი, რომელიც რელეში აღმოაჩინეს. ჩანაწერი ინახება ამერიკის ისტორიის ეროვნულ მუზეუმში.',
    },
    why: {
      ka: 'სიტყვა „bug" ინჟინრებში უკვე ადრეც იხმარებოდა გაუმართაობის აღსანიშნავად — ეს შემთხვევა კი ტერმინის ყველაზე ცნობილი ილუსტრაცია გახდა.',
    },
    difficulty: 1,
    topicIds: ['computing-history'],
    source: SRC.smithsonian(
      'Log Book With Computer Bug',
      'https://americanhistory.si.edu/collections/object/nmah_334663',
    ),
  },
  {
    id: 'f-moore-law',
    subjectId: 'cs',
    text: {
      ka: 'მურის კანონი ბუნების კანონი არ არის — ეს 1965 წელს გაკეთებული დაკვირვება იყო, რომ ჩიპზე ტრანზისტორების რაოდენობა დაახლოებით ორ წელიწადში ორმაგდება.',
    },
    why: {
      ka: 'ის ათწლეულების განმავლობაში მართლდებოდა ნაწილობრივ იმიტომ, რომ ინდუსტრიამ ის *მიზნად* აქცია. ბოლო წლებში ტემპი შენელდა და განვითარება სხვა მიმართულებით — მრავალბირთვიან და სპეციალიზებულ ჩიპებში — გადავიდა.',
    },
    difficulty: 3,
    topicIds: ['computing-history'],
    source: SRC.britannica('Moore’s law', 'https://www.britannica.com/technology/Moores-law'),
  },
  {
    id: 'f-public-key',
    subjectId: 'cs',
    text: {
      ka: 'თანამედროვე დაშიფვრა იმაზეა აგებული, რომ ორი დიდი მარტივი რიცხვის გადამრავლება ადვილია, უკან დაშლა კი — პრაქტიკულად შეუძლებელი.',
    },
    why: {
      ka: 'ეს „ცალმხრივი ფუნქციის" იდეაა. სწორედ ამიტომ იწვევს კვანტური კომპიუტერები ასეთ ინტერესს: შორის ალგორითმი თეორიულად სწრაფად შლის რიცხვს მამრავლებად.',
    },
    difficulty: 4,
    topicIds: ['cryptography', 'prime-numbers'],
    source: SRC.britannica('Public-key cryptography', 'https://www.britannica.com/topic/public-key-cryptography'),
  },

  /* ---------------- ისტორია ---------------- */
  {
    id: 'f-library-alexandria',
    subjectId: 'history',
    text: {
      ka: 'ალექსანდრიის ბიბლიოთეკა ერთ ღამეში არ განადგურებულა. ისტორიკოსები თანხმდებიან, რომ ის რამდენიმე საუკუნის განმავლობაში, თანდათან დაკნინდა.',
    },
    why: {
      ka: 'ერთი დრამატული კატასტროფის ისტორია უფრო ადვილად ხსოვნაშია, ვიდრე ნელი დაცემა — მაგრამ წყაროები მეორეს ადასტურებენ. ეს კარგი მაგალითია, როგორ უნდა შევამოწმოთ ცნობილი ისტორიები.',
    },
    difficulty: 3,
    source: SRC.britannica('Library of Alexandria', 'https://www.britannica.com/topic/Library-of-Alexandria'),
  },
  {
    id: 'f-printing-press',
    subjectId: 'history',
    text: {
      ka: 'გუტენბერგის სტამბამდე ერთი წიგნის გადაწერას თვეები სჭირდებოდა. 1500 წლისთვის ევროპაში უკვე მილიონობით ნაბეჭდი წიგნი იყო.',
    },
    why: {
      ka: 'ტექნოლოგიამ არა მხოლოდ წიგნები გააიაფა — მან ცოდნის გავრცელების სიჩქარე შეცვალა. რეფორმაცია და სამეცნიერო რევოლუცია ამის გარეშე ძნელად წარმოსადგენია.',
    },
    difficulty: 2,
    topicIds: ['printing-revolution'],
    source: SRC.britannica('Printing press', 'https://www.britannica.com/technology/printing-press'),
  },
  {
    id: 'f-georgian-alphabet',
    subjectId: 'georgian-history',
    text: {
      ka: 'ქართული დამწერლობის სამი სახეობა — ასომთავრული, ნუსხური და მხედრული — 2016 წელს იუნესკოს არამატერიალური კულტურული მემკვიდრეობის სიაში შევიდა.',
    },
    why: {
      ka: 'სამივე ერთდროულად კი არ არსებობდა — ისინი ერთმანეთს დროში მოჰყვა. დღეს ვწერთ მხედრულით, რომელსაც, სხვა ბევრი დამწერლობისგან განსხვავებით, დიდი და პატარა ასოები არ აქვს.',
    },
    difficulty: 2,
    topicIds: ['georgian-script'],
    source: {
      label: 'Living culture of three writing systems of the Georgian alphabet',
      publisher: 'UNESCO',
      url: 'https://ich.unesco.org/en/RL/living-culture-of-three-writing-systems-of-the-georgian-alphabet-01205',
      year: 2016,
      kind: 'institution',
    },
  },
  {
    id: 'f-dmanisi',
    subjectId: 'georgian-history',
    text: {
      ka: 'დმანისში (ქვემო ქართლი) ნაპოვნი ჰომინიდების ნაშთები დაახლოებით 1.8 მილიონი წლისაა — ეს აფრიკის გარეთ აღმოჩენილი ერთ-ერთი უძველესი მტკიცებულებაა ადამიანის წინაპრების შესახებ.',
    },
    why: {
      ka: 'დმანისის აღმოჩენებმა შეცვალა წარმოდგენა იმაზე, თუ როდის დატოვეს ჰომინიდებმა აფრიკა. ეს საქართველოს ტერიტორიას მსოფლიო პალეოანთროპოლოგიის რუკაზე ერთ-ერთ საკვანძო ადგილას აყენებს.',
    },
    difficulty: 3,
    source: SRC.nature(
      'Lordkipanidze et al., "A Complete Skull from Dmanisi, Georgia" (Science 342)',
      'https://www.science.org/doi/10.1126/science.1238484',
      2013,
    ),
  },
  {
    id: 'f-wine-georgia',
    subjectId: 'georgian-history',
    text: {
      ka: 'საქართველოში აღმოჩენილი ქვევრის ნატეხები, რომლებზეც ღვინის კვალია, დაახლოებით ძვ. წ. 6000 წლით თარიღდება — ეს ღვინის წარმოების ერთ-ერთი უძველესი ცნობილი მტკიცებულებაა მსოფლიოში.',
    },
    why: {
      ka: 'დათარიღება ქიმიურ ანალიზს ეყრდნობა: კერამიკაში შემორჩენილი ღვინის მჟავას ნაშთებს. არქეოლოგია დღეს ლაბორატორიულ მეთოდებზეა დამოკიდებული ისევე, როგორც გათხრებზე.',
    },
    difficulty: 3,
    source: {
      label: 'McGovern et al., "Early Neolithic wine of Georgia in the South Caucasus", PNAS',
      publisher: 'PNAS',
      url: 'https://www.pnas.org/doi/10.1073/pnas.1714728114',
      year: 2017,
      kind: 'journal',
    },
  },

  /* ---------------- დედამიწა და გარემო ---------------- */
  {
    id: 'f-earthquake-scale',
    subjectId: 'earth',
    text: {
      ka: 'მაგნიტუდის სკალა ლოგარითმულია: 6-იანი მიწისძვრა 5-იანზე დაახლოებით 32-ჯერ მეტ ენერგიას ათავისუფლებს, არა ერთით მეტს.',
    },
    why: {
      ka: 'ამიტომ არის განსხვავება 7-სა და 8-ს შორის კატასტროფული. ლოგარითმული სკალები ყველგან გვხვდება, სადაც სიდიდეები მილიონობითჯერ განსხვავდება.',
    },
    difficulty: 3,
    topicIds: ['earthquakes'],
    source: SRC.usgs('Earthquake Magnitude, Energy Release, and Shaking Intensity', 'https://www.usgs.gov/programs/earthquake-hazards/earthquake-magnitude-energy-release-and-shaking-intensity'),
  },
  {
    id: 'f-ocean-unexplored',
    subjectId: 'earth',
    text: {
      ka: 'მსოფლიო ოკეანის ფსკერის დიდი ნაწილი დღემდე დეტალურად არ არის აზომილი — თანამედროვე მაღალი გარჩევადობით რუკაზე მისი მხოლოდ მცირე ნაწილია.',
    },
    why: {
      ka: 'მიზეზი ის არის, რომ რადიოტალღები წყალში არ გადის და თანამგზავრი ფსკერს პირდაპირ ვერ „ხედავს". რუკის შესადგენად გემი ფიზიკურად უნდა გაცუროს — ამიტომაა პროცესი ასეთი ნელი.',
    },
    difficulty: 2,
    source: SRC.noaa('How much of the ocean have we explored?', 'https://oceanservice.noaa.gov/facts/exploration.html'),
  },
  {
    id: 'f-atmosphere-pressure',
    subjectId: 'earth',
    text: {
      ka: 'ატმოსფერო შენს მხრებზე დაახლოებით ტონა ჰაერს აწვება — უბრალოდ ეს წნევა ყველა მიმართულებით თანაბრად მოქმედებს და ამიტომ არ ვგრძნობთ.',
    },
    why: {
      ka: 'ეს ზუსტად ის იდეაა, რომელიც ტორიჩელმა 1643 წელს დაამტკიცა ვერცხლისწყლის სვეტით. ჩვენ „ჰაერის ოკეანის" ფსკერზე ვცხოვრობთ.',
    },
    difficulty: 2,
    source: SRC.noaa('Atmospheric pressure', 'https://www.noaa.gov/jetstream/atmosphere/air-pressure'),
  },
  {
    id: 'f-lightning-temperature',
    subjectId: 'meteorology',
    text: {
      ka: 'ელვის არხის ტემპერატურა შეიძლება 30 000 °C-ს მიაღწიოს — ეს მზის ხილული ზედაპირის ტემპერატურაზე დაახლოებით ხუთჯერ მეტია.',
    },
    why: {
      ka: 'ჰაერის უეცარი გაფართოება სწორედ ამ სითბოს გამო ქმნის ჭექა-ქუხილს. ანუ ჭექა ელვის *შედეგია*, არა ცალკე მოვლენა.',
    },
    difficulty: 2,
    source: SRC.noaa('Understanding Lightning', 'https://www.weather.gov/safety/lightning-science-overview'),
  },
  {
    id: 'f-co2-record',
    subjectId: 'ecology',
    text: {
      ka: 'მაუნა-ლოაზე ატმოსფეროში CO₂-ის უწყვეტი გაზომვა 1958 წლიდან მიმდინარეობს. ეს ერთ-ერთი ყველაზე გრძელი უწყვეტი სამეცნიერო დაკვირვების რიგია პლანეტაზე.',
    },
    why: {
      ka: 'ამ მონაცემებმა აჩვენა როგორც წლიური სეზონური რხევა, ისე მდგრადი ზრდის ტენდენცია. გრძელვადიანი, მოსაწყენი გაზომვა ხშირად უფრო ღირებულია, ვიდრე ერთჯერადი ეფექტური ექსპერიმენტი.',
    },
    difficulty: 2,
    source: SRC.noaa('Trends in Atmospheric Carbon Dioxide', 'https://gml.noaa.gov/ccgg/trends/'),
  },

  /* ------------------------- ინფორმატიკა და AI ------------------------- */
  {
    id: 'f-python-name',
    subjectId: 'programming',
    text: {
      ka: 'პროგრამირების ენა Python გველის სახელით არ ჰქვია — გვიდო ვან როსუმმა ის კომედიური ჯგუფის „Monty Python"-ის საპატივცემულოდ დაარქვა 1991 წელს.',
    },
    why: {
      ka: 'ენების, ბიბლიოთეკებისა და ხელსაწყოების სახელები ხშირად ხუმრობა ან შიდა მინიშნებაა. ტექნიკური სამყარო ნაკლებად ფორმალურია, ვიდრე გარედან ჩანს — და ეს კულტურის ნაწილია.',
    },
    difficulty: 1,
    topicIds: ['how-code-runs'],
    tags: ['Python', 'ისტორია'],
    source: SRC.britannica('Python (computer language)', 'https://www.britannica.com/technology/Python-computer-language'),
  },
  {
    id: 'f-null-mistake',
    subjectId: 'programming',
    text: {
      ka: 'ტონი ჰოარმა, რომელმაც 1965 წელს „null მიმართვა" შემოიღო, 2009 წელს მას საკუთარი „მილიარდ-დოლარიანი შეცდომა" უწოდა — მისი შეფასებით, ამ ერთმა იდეამ ათწლეულების განმავლობაში მილიარდობით დოლარის ზიანი მოიტანა ავარიებითა და უსაფრთხოების ხვრელებით.',
    },
    why: {
      ka: '„არაფრის" წარმოდგენა იმავენაირად, როგორც რეალური მნიშვნელობის, ნიშნავს, რომ ყოველი ცვლადი ფარულად შეიძლება „ცარიელი" იყოს. თანამედროვე ენები (Rust, Kotlin, Swift) ამ შესაძლებლობას ტიპში ცხადად აღნიშნავენ.',
    },
    difficulty: 3,
    topicIds: ['bugs-and-debugging', 'variables-and-types', 'data-structures'],
    tags: ['null', 'ბაგი'],
    source: SRC.britannica('Tony Hoare', 'https://www.britannica.com/biography/Tony-Hoare'),
  },
  {
    id: 'f-git-speed',
    subjectId: 'programming',
    text: {
      ka: 'ლინუს ტორვალდსმა Git-ის პირველი მუშა ვერსია 2005 წელს რამდენიმე დღეში დაწერა — და უკვე მესამე დღეს Git თავად ინახავდა Git-ის კოდის ისტორიას.',
    },
    why: {
      ka: 'როცა ხელსაწყო საკუთარ თავზე მუშაობს („bootstrapping"), ეს ერთდროულად ტესტიცაა და ნდობის ნიშანიც. Git-ის დიზაინი — უცვლელი, ჰეშით დამოწმებული ისტორია — სწორედ ამ სისწრაფის მოთხოვნიდან დაიბადა.',
    },
    difficulty: 2,
    topicIds: ['version-control'],
    tags: ['Git', 'ისტორია'],
    source: SRC.britannica('Linus Torvalds', 'https://www.britannica.com/biography/Linus-Torvalds'),
  },
  {
    id: 'f-dijkstra-cafe',
    subjectId: 'algorithms',
    text: {
      ka: 'ედსხერ დაიქსტრამ უმოკლესი გზის ცნობილი ალგორითმი 1956 წელს, ამსტერდამის კაფეში, დაახლოებით 20 წუთში მოიფიქრა — კალამ-ქაღალდის გარეშე.',
    },
    why: {
      ka: 'დაიქსტრას თქმით, ფურცლის არქონამ აიძულა ალგორითმი მაქსიმალურად მარტივი გამოეყვანა. ხანდახან შეზღუდვა უკეთეს შედეგს იძლევა, ვიდრე უსაზღვრო რესურსი.',
    },
    difficulty: 2,
    topicIds: ['graphs-and-paths'],
    tags: ['დაიქსტრა', 'გრაფი'],
    source: SRC.britannica('Edsger Dijkstra', 'https://www.britannica.com/biography/Edsger-Dijkstra'),
  },
  {
    id: 'f-p-vs-np-prize',
    subjectId: 'algorithms',
    text: {
      ka: 'P vs NP არის კლეის მათემატიკის ინსტიტუტის შვიდი „მილენიუმის ამოცანიდან" ერთ-ერთი, თითოეულზე დაწესებული 1 000 000 დოლარის პრიზით. 2000 წლიდან მხოლოდ ერთია ამოხსნილი — პუანკარეს ჰიპოთეზა.',
    },
    why: {
      ka: 'კითხვა — „თუ პასუხის შემოწმება სწრაფია, სწრაფია თუ არა პასუხის პოვნაც" — მარტივად ჟღერს, მაგრამ 50 წელია ღიაა. მისი ამოხსნა შეცვლიდა კრიპტოგრაფიას, ლოგისტიკასა და მეცნიერულ აღმოჩენას.',
    },
    difficulty: 4,
    topicIds: ['p-vs-np', 'algorithm-complexity'],
    tags: ['სირთულე', 'მილენიუმის ამოცანა'],
    source: {
      label: 'P vs NP Problem',
      publisher: 'Clay Mathematics Institute',
      url: 'https://www.claymath.org/millennium/p-vs-np/',
      kind: 'institution',
    },
  },
  {
    id: 'f-transformer-2017',
    subjectId: 'ai',
    text: {
      ka: 'თანამედროვე ენობრივი მოდელების საფუძველი — „ტრანსფორმერის" არქიტექტურა — 2017 წელს ერთ, რვაგვერდიან ნაშრომში აღიწერა: „Attention Is All You Need", ავტორები — Google-ის რვა მკვლევარი.',
    },
    why: {
      ka: 'ერთმა არქიტექტურულმა იდეამ — თანმიმდევრობის ნაცვლად, ყოველი სიტყვა ერთდროულად ხედავს ყველა სხვას — შესაძლებელი გახადა მოდელების მასშტაბირება მილიარდობით პარამეტრამდე. GPT, Claude და Gemini — ყველა მისი შთამომავალია.',
    },
    difficulty: 3,
    topicIds: ['large-language-models', 'neural-networks'],
    tags: ['ტრანსფორმერი', 'LLM'],
    source: {
      label: 'Attention Is All You Need',
      publisher: 'arXiv',
      url: 'https://arxiv.org/abs/1706.03762',
      year: 2017,
      kind: 'journal',
    },
  },
  {
    id: 'f-alphago-intuition',
    subjectId: 'ai',
    text: {
      ka: 'AlphaGo-ს 2016 წლის მატჩში ლი სედოლის წინააღმდეგ, მე-2 პარტიის 37-ე სვლა ექსპერტებმა ჯერ შეცდომად ჩათვალეს — ადამიანი ასე არ თამაშობს. სწორედ ის აღმოჩნდა გამარჯვების გასაღები.',
    },
    why: {
      ka: 'Deep Blue-მ ჭადრაკი უხეში ძალით მოიგო; AlphaGo-მ გო მოიგო *ნასწავლი ინტუიციით*. ეს იყო ნიშანი, რომ ნეირონულ ქსელს შეუძლია ისეთი ნიმუშების დანახვა, რომლებსაც ადამიანი ვერ აყალიბებს წესებად.',
    },
    difficulty: 2,
    topicIds: ['search-and-games'],
    tags: ['AlphaGo', 'ინტუიცია'],
    source: SRC.nature('Mastering the game of Go with deep neural networks and tree search', 'https://www.nature.com/articles/nature16961', 2016),
  },

  /* ------------------------- კულტურა და ისტორია ------------------------- */
  {
    id: 'f-voyager-chakrulo',
    subjectId: 'music',
    text: {
      ka: '1977 წელს Voyager-ის ხომალდებზე დამაგრებულ „ოქროს ფირფიტაზე" — კაცობრიობის ხმად სხვა ცივილიზაციებისთვის — ჩაწერილ 27 მუსიკალურ ნაწარმოებს შორის ქართული სამხმიანი „ჩაკრულოც" მოხვდა.',
    },
    why: {
      ka: 'ფირფიტის შემდგენლებმა (კარლ საგანის ჯგუფი) სამყაროს მრავალფეროვანი მუსიკიდან ქართული პოლიფონია ცალკე ტრადიციად შეარჩიეს. ხომალდები დღეს მზის სისტემას გარეთ მოძრაობენ.',
    },
    difficulty: 1,
    topicIds: ['georgian-polyphony'],
    tags: ['ჩაკრულო', 'პოლიფონია', 'Voyager'],
    source: SRC.nasa('voyager/nasa-golden-record/', 'The Golden Record — Music From Earth'),
  },
];
