import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@min_app/database_v1';

export const EDUCATIONS = ['ha(IT) - CBS', 'ha(JUR) - CBS', 'ha(almen) - CBS'];

export const INITIAL_JOBS = [
  {
    id: 'job-it-1',
    company: 'Unity Technologies',
    companyId: 'company-unity',
    position: 'Junior Software Developer',
    educations: ['ha(IT) - CBS'],
    shortDescription: 'Arbejd med Unity-engine og udvikling af kreative digitale løsninger i København.',
    fullDescription: 'Bliv en del af et udviklingsteam, der arbejder med interaktive digitale produkter. Du hjælper med at udvikle og vedligeholde funktioner i Unity, afprøve prototyper og finde fejl i eksisterende løsninger. Du samarbejder med udviklere og designere og får løbende feedback på dit arbejde. Stillingen er på deltid, cirka 10-15 timer om ugen, med fleksibilitet omkring undervisning og eksamener.',
    ratings: {},
  },
  {
    id: 'job-it-2',
    company: 'Microsoft Denmark',
    companyId: 'company-microsoft',
    position: 'IT Support Specialist',
    educations: ['ha(IT) - CBS'],
    shortDescription: 'Hjælp kunder med tekniske problemstillinger og understøt virksomhedens IT-infrastruktur.',
    fullDescription: 'Du hjælper med at undersøge og løse almindelige tekniske problemer, registrerer henvendelser og udarbejder korte vejledninger, så løsningerne er nemme at genbruge. Du arbejder tæt sammen med supportteamet og lærer at kommunikere tekniske svar klart til forskellige brugere. Stillingen er på deltid, cirka 10-15 timer om ugen, og arbejdstiderne planlægges med hensyn til dit studie.',
    ratings: {},
  },
  {
    id: 'job-jur-1',
    company: 'Plesner',
    companyId: 'company-plesner',
    position: 'Studentermedhjælper, Legal Tech',
    educations: ['ha(JUR) - CBS'],
    shortDescription: 'Understøt juridiske teams med research, sagsforberedelse og digitale arbejdsgange.',
    fullDescription: 'Du hjælper med juridisk research, strukturering af dokumenter og klargøring af materiale til sager. Derudover bidrager du til at afprøve digitale værktøjer, der kan gøre juridiske arbejdsgange mere overskuelige. Du får indblik i samarbejdet mellem juridiske specialister og teknologi. Stillingen er på deltid, cirka 10-15 timer om ugen, med mulighed for at tilpasse arbejdstiden efter undervisning og eksamener.',
    ratings: {},
  },
  {
    id: 'job-jur-2',
    company: 'Maersk',
    companyId: 'company-maersk',
    position: 'Student Assistant, Compliance',
    educations: ['ha(JUR) - CBS'],
    shortDescription: 'Hjælp med kontraktgennemgang, compliance-processer og juridisk koordinering.',
    fullDescription: 'Du hjælper teamet med at gennemgå og organisere kontraktmateriale, følge op på dokumentation og samle information til compliance-processer. Du bidrager også til at vedligeholde oversigter og koordinere praktiske opgaver på tværs af relevante teams. Stillingen er på deltid, cirka 10-15 timer om ugen, og planlægges fleksibelt omkring dit studie.',
    ratings: {},
  },
  {
    id: 'job-almen-1',
    company: 'Danske Bank',
    companyId: 'company-danske-bank',
    position: 'Student Analyst, Business Banking',
    educations: ['ha(almen) - CBS'],
    shortDescription: 'Analyser forretning, økonomi og kundebehov i et team for erhvervskunder.',
    fullDescription: 'Du indsamler og strukturerer data, udarbejder regneark og hjælper med analyser af virksomheders økonomi og behov. Du bidrager til præsentationer og beslutningsmateriale og får mulighed for at omsætte faglig viden fra studiet til konkrete problemstillinger. Stillingen er på deltid, cirka 15-20 timer om ugen, med arbejdstid aftalt under hensyn til undervisning og eksamener.',
    ratings: {},
  },
  {
    id: 'job-almen-2',
    company: 'Carlsberg Group',
    companyId: 'company-carlsberg',
    position: 'Student Assistant, Marketing',
    educations: ['ha(almen) - CBS'],
    shortDescription: 'Bidrag til markedsanalyser, kampagneplanlægning og kommercielle projekter.',
    fullDescription: 'Du hjælper med at undersøge markedstendenser, samle resultater fra kampagner og forberede materiale til marketingteamets projekter. Du kan også bidrage til planlægning af aktiviteter og koordinering med kolleger på tværs af funktioner. Stillingen er på deltid, cirka 10-15 timer om ugen, med fleksibilitet i eksamensperioder.',
    ratings: {},
  },
];

export const COMPANY_ACCOUNTS = [
  { id: 'company-unity', username: 'unity', password: 'unity123', role: 'company', companyName: 'Unity Technologies' },
  { id: 'company-microsoft', username: 'microsoft', password: 'microsoft123', role: 'company', companyName: 'Microsoft Denmark' },
  { id: 'company-plesner', username: 'plesner', password: 'plesner123', role: 'company', companyName: 'Plesner' },
  { id: 'company-maersk', username: 'maersk', password: 'maersk123', role: 'company', companyName: 'Maersk' },
  { id: 'company-danske-bank', username: 'danskebank', password: 'bank123', role: 'company', companyName: 'Danske Bank' },
  { id: 'company-carlsberg', username: 'carlsberg', password: 'carlsberg123', role: 'company', companyName: 'Carlsberg Group' },
];

export function getMatchingStudents(job, database) {
  const jobEducations = Array.isArray(job.educations) ? job.educations : [];
  return database.accounts.filter(account => {
    const education = database.profiles[account.id]?.education;
    return account.role === 'seeker' && typeof education === 'string' && jobEducations.includes(education);
  });
}

// Laver en tom database med de første jobopslag.
const createDatabase = () => ({ accounts: [], activeUserId: null, profiles: {}, jobs: INITIAL_JOBS, chats: {} });

// Henter databasen og tilføjer manglende standarddata.
export async function readDatabase() {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  const database = stored ? { ...createDatabase(), ...JSON.parse(stored) } : createDatabase();
  database.accounts = Array.isArray(database.accounts) ? database.accounts : [];
  database.jobs = Array.isArray(database.jobs) ? database.jobs : INITIAL_JOBS;
  database.profiles = database.profiles || {};
  database.chats = database.chats || {};

  for (const companyAccount of COMPANY_ACCOUNTS) {
    if (!database.accounts.some(account => account.id === companyAccount.id)) {
      database.accounts.push(companyAccount);
    }
  }

  database.accounts = database.accounts.map(account => ({ ...account, role: account.role || 'seeker' }));
  database.jobs = database.jobs.map(job => {
    const companyAccount = COMPANY_ACCOUNTS.find(account => account.companyName === job.company);
    const defaultJob = INITIAL_JOBS.find(item => item.id === job.id);
    const { description: legacyDescription, ...jobData } = job;
    return {
      ...jobData,
      companyId: job.companyId || companyAccount?.id,
      educations: Array.isArray(job.educations) ? job.educations : [],
      shortDescription: job.shortDescription || legacyDescription || defaultJob?.shortDescription || '',
      fullDescription: job.fullDescription || defaultJob?.fullDescription || legacyDescription || '',
      ratings: job.ratings || {},
      applications: job.applications || {},
    };
  });

  await writeDatabase(database);
  return database;
}

// Gemmer hele databasen lokalt på telefonen.
export async function writeDatabase(database) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(database));
}