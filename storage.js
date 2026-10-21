import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@min_app/database_v1';

export const EDUCATIONS = ['ha(IT) - CBS', 'ha(JUR) - CBS', 'ha(almen) - CBS'];

export const INITIAL_JOBS = [
  { id: 'job-it-1', company: 'Unity Technologies', companyId: 'company-unity', position: 'Junior Software Developer', educations: ['ha(IT) - CBS'], description: 'Arbejd med Unity-engine og udvikling af kreative digitale løsninger i København.', ratings: {} },
  { id: 'job-it-2', company: 'Microsoft Denmark', companyId: 'company-microsoft', position: 'IT Support Specialist', educations: ['ha(IT) - CBS'], description: 'Hjælp kunder med tekniske problemstillinger og vær med til at understøtte Microsofts IT-infrastruktur.', ratings: {} },
  { id: 'job-jur-1', company: 'Plesner', companyId: 'company-plesner', position: 'Studentermedhjælper, Legal Tech', educations: ['ha(JUR) - CBS'], description: 'Understøt juridiske teams med research, sagsforberedelse og digitale arbejdsgange.', ratings: {} },
  { id: 'job-jur-2', company: 'Maersk', companyId: 'company-maersk', position: 'Student Assistant, Compliance', educations: ['ha(JUR) - CBS'], description: 'Hjælp med kontraktgennemgang, compliance-processer og juridisk koordinering på tværs af organisationen.', ratings: {} },
  { id: 'job-almen-1', company: 'Danske Bank', companyId: 'company-danske-bank', position: 'Student Analyst, Business Banking', educations: ['ha(almen) - CBS'], description: 'Analyser forretning, økonomi og kundebehov som del af et team for erhvervskunder.', ratings: {} },
  { id: 'job-almen-2', company: 'Carlsberg Group', companyId: 'company-carlsberg', position: 'Student Assistant, Marketing', educations: ['ha(almen) - CBS'], description: 'Bidrag til markedsanalyser, kampagneplanlægning og kommercielle projekter.', ratings: {} },
];

export const COMPANY_ACCOUNTS = [
  { id: 'company-unity', username: 'unity', password: 'unity123', role: 'company', companyName: 'Unity Technologies' },
  { id: 'company-microsoft', username: 'microsoft', password: 'microsoft123', role: 'company', companyName: 'Microsoft Denmark' },
  { id: 'company-plesner', username: 'plesner', password: 'plesner123', role: 'company', companyName: 'Plesner' },
  { id: 'company-maersk', username: 'maersk', password: 'maersk123', role: 'company', companyName: 'Maersk' },
  { id: 'company-danske-bank', username: 'danskebank', password: 'bank123', role: 'company', companyName: 'Danske Bank' },
  { id: 'company-carlsberg', username: 'carlsberg', password: 'carlsberg123', role: 'company', companyName: 'Carlsberg Group' },
];

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
    return {
      ...job,
      companyId: job.companyId || companyAccount?.id,
      educations: Array.isArray(job.educations) ? job.educations : [],
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