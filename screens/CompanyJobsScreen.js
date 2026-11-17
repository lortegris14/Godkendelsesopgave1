import { useEffect, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { companyJobsStyles as styles } from '../styles';
import { EDUCATIONS, JOB_LOCATIONS, JOB_TYPES, getMatchingStudents, readDatabase, writeDatabase } from '../storage';
import { notifyMatchingStudents } from '../notifications';

const emptyForm = { position: '', educations: [], jobType: '', city: '', shortDescription: '', fullDescription: '' };

// Viser virksomhedens job og giver adgang til at oprette, rette og slette dem.
export default function CompanyJobsScreen({ company, onLogout }) {
  const [jobs, setJobs] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [educationMenuOpen, setEducationMenuOpen] = useState(false);
  const [jobTypeMenuOpen, setJobTypeMenuOpen] = useState(false);
  const [cityMenuOpen, setCityMenuOpen] = useState(false);

  // Henter de jobopslag, der tilhører virksomheden.
  const refreshJobs = async () => {
    const database = await readDatabase();
    setJobs(database.jobs.filter(job => job.companyId === company.id));
  };

  useEffect(() => {
    refreshJobs();
  }, [company.id]);

  // Åbner en tom formular til et nyt jobopslag.
  const startCreate = () => {
    setEditingId('new');
    setForm(emptyForm);
  };

  // Fylder formularen med oplysninger fra det valgte job.
  const startEdit = job => {
    setEditingId(job.id);
    setForm({
      position: job.position,
      educations: [...job.educations],
      jobType: job.jobType || '',
      city: job.city || '',
      shortDescription: job.shortDescription,
      fullDescription: job.fullDescription,
    });
  };

  // Tilføjer eller fjerner en uddannelse fra jobopslaget.
  const toggleEducation = education => {
    setForm(previous => ({
      ...previous,
      educations: previous.educations.includes(education)
        ? previous.educations.filter(item => item !== education)
        : [...previous.educations, education],
    }));
  };

  // Gemmer et nyt job eller opdaterer det eksisterende.
  const saveJob = async () => {
    if (!form.position.trim() || !form.shortDescription.trim() || !form.fullDescription.trim() || !form.educations.length || !form.jobType || !form.city) {
      Alert.alert('Udfyld felterne', 'Angiv stilling, mindst én uddannelse, jobtype, by, en kort beskrivelse og en uddybende beskrivelse.');
      return;
    }
    try {
      const database = await readDatabase();
      let createdJob = null;
      if (editingId === 'new') {
        createdJob = {
          id: `job-${company.id}-${Date.now()}`,
          company: company.companyName,
          companyId: company.id,
          position: form.position.trim(),
          educations: form.educations,
          jobType: form.jobType,
          city: form.city,
          shortDescription: form.shortDescription.trim(),
          fullDescription: form.fullDescription.trim(),
          ratings: {},
          applications: {},
        };
        database.jobs.push(createdJob);
        const sentAt = new Date().toISOString();
        for (const student of getMatchingStudents(createdJob, database)) {
          const chatId = `${createdJob.id}:${student.id}`;
          if (database.chats[chatId]) continue;
          database.chats[chatId] = {
            id: chatId,
            jobId: createdJob.id,
            companyId: company.id,
            seekerId: student.id,
            messages: [{
              id: `recommendation-${createdJob.id}`,
              senderId: company.id,
              text: `Vi har fundet et jobopslag hos ${createdJob.company}, som kunne være relevant for dig: ${createdJob.position}.`,
              kind: 'job-recommendation',
              jobId: createdJob.id,
              sentAt,
            }],
          };
        }
      } else {
        database.jobs = database.jobs.map(job => job.id === editingId && job.companyId === company.id
          ? {
            ...job,
            position: form.position.trim(),
            educations: form.educations,
            jobType: form.jobType,
            city: form.city,
            shortDescription: form.shortDescription.trim(),
            fullDescription: form.fullDescription.trim(),
          }
          : job);
      }
      await writeDatabase(database);
      setEditingId(null);
      await refreshJobs();

      if (createdJob) {
        try {
          const result = await notifyMatchingStudents(createdJob, database);
          if (result.permissionDenied) {
            Alert.alert('Jobopslag gemt', 'Tillad notifikationer i telefonens indstillinger for at modtage beskeder om matchende job.');
          }
        } catch {
          Alert.alert('Jobopslag gemt', 'Notifikationen kunne ikke sendes, men jobopslaget er gemt.');
        }
      }
    } catch {
      Alert.alert('Kunne ikke gemme', 'Jobopslaget blev ikke gemt. Prøv igen.');
    }
  };

  // Beder om bekræftelse og sletter jobbet med tilhørende data.
  const confirmDelete = job => {
    Alert.alert(
      'Slet jobopslag?',
      'Opslaget, ansøgninger, bedømmelser og tilhørende chats slettes permanent.',
      [
        { text: 'Annuller', style: 'cancel' },
        {
          text: 'Slet',
          style: 'destructive',
          onPress: async () => {
            try {
              const database = await readDatabase();
              const relatedChats = Object.values(database.chats).filter(chat => chat.jobId === job.id);
              const attachmentUris = relatedChats.flatMap(chat =>
                (chat.messages || []).flatMap(message => (message.files || []).map(file => file.uri)),
              );
              database.jobs = database.jobs.filter(item => item.id !== job.id || item.companyId !== company.id);
              database.chats = Object.fromEntries(
                Object.entries(database.chats).filter(([, chat]) => chat.jobId !== job.id),
              );
              await writeDatabase(database);
              await Promise.all(attachmentUris.map(uri => FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {})));
              setJobs(database.jobs.filter(item => item.companyId === company.id));
            } catch {
              Alert.alert('Kunne ikke slette', 'Prøv igen om et øjeblik.');
            }
          },
        },
      ],
    );
  };

  // Finder gennemsnittet af jobbets bedømmelser.
  const getRating = job => {
    const ratings = Object.values(job.ratings || {});
    return ratings.length ? ratings.reduce((total, rating) => total + rating, 0) / ratings.length : 0;
  };

  // Tæller ansøgningerne for hver uddannelse.
  const getApplicationCounts = job => EDUCATIONS.map(education => ({
    education,
    count: Object.values(job.applications || {}).filter(application => application.education === education).length,
  }));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1f77d2' }} edges={['top']}>
    <ScrollView style={styles.container} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <View style={styles.header}>
        <Text style={styles.title}>Mine jobopslag</Text>
        <Text style={styles.companyName}>{company.companyName}</Text>
      </View>

      {editingId ? (
        <View style={styles.editor}>
          <Text style={styles.editorTitle}>{editingId === 'new' ? 'Nyt jobopslag' : 'Rediger jobopslag'}</Text>
          <Text style={styles.label}>Virksomhed</Text>
          <Text style={styles.readOnlyField}>{company.companyName}</Text>
          <Text style={styles.label}>Stilling</Text>
          <TextInput style={styles.input} value={form.position} onChangeText={position => setForm(current => ({ ...current, position }))} placeholder="Stillingens navn" />
          <Text style={styles.label}>Tilknyttede uddannelser</Text>
          <TouchableOpacity style={styles.dropdown} onPress={() => setEducationMenuOpen(value => !value)}>
            <Text style={styles.dropdownText}>{form.educations.length ? form.educations.join(', ') : 'Vælg uddannelser'}</Text>
            <Text style={styles.dropdownArrow}>{educationMenuOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {educationMenuOpen ? EDUCATIONS.map(education => (
            <TouchableOpacity key={education} style={styles.option} onPress={() => toggleEducation(education)}>
              <Text style={styles.dropdownText}>{form.educations.includes(education) ? '✓  ' : ''}{education}</Text>
            </TouchableOpacity>
          )) : null}
          <Text style={styles.label}>Arbejdstid</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setJobTypeMenuOpen(value => !value)}
            accessibilityRole="button"
            accessibilityState={{ expanded: jobTypeMenuOpen }}
          >
            <Text style={styles.dropdownText}>{form.jobType || 'Vælg fuldtid eller deltid'}</Text>
            <Text style={styles.dropdownArrow}>{jobTypeMenuOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {jobTypeMenuOpen ? JOB_TYPES.map(jobType => (
            <TouchableOpacity
              key={jobType}
              style={styles.option}
              onPress={() => {
                setForm(current => ({ ...current, jobType }));
                setJobTypeMenuOpen(false);
              }}
            >
              <Text style={styles.dropdownText}>{form.jobType === jobType ? '✓  ' : ''}{jobType}</Text>
            </TouchableOpacity>
          )) : null}
          <Text style={styles.label}>By</Text>
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setCityMenuOpen(value => !value)}
            accessibilityRole="button"
            accessibilityState={{ expanded: cityMenuOpen }}
          >
            <Text style={styles.dropdownText}>{form.city || 'Vælg by'}</Text>
            <Text style={styles.dropdownArrow}>{cityMenuOpen ? '▲' : '▼'}</Text>
          </TouchableOpacity>
          {cityMenuOpen ? JOB_LOCATIONS.map(city => (
            <TouchableOpacity
              key={city}
              style={styles.option}
              onPress={() => {
                setForm(current => ({ ...current, city }));
                setCityMenuOpen(false);
              }}
            >
              <Text style={styles.dropdownText}>{form.city === city ? '✓  ' : ''}{city}</Text>
            </TouchableOpacity>
          )) : null}
          <Text style={styles.label}>Kort beskrivelse (vises på joblisten)</Text>
          <TextInput
            style={[styles.input, styles.descriptionInput]}
            value={form.shortDescription}
            onChangeText={shortDescription => setForm(current => ({ ...current, shortDescription }))}
            placeholder="Skriv en kort introduktion til jobbet"
            multiline
          />
          <Text style={styles.label}>Uddybende jobbeskrivelse</Text>
          <TextInput
            style={[styles.input, styles.descriptionInput]}
            value={form.fullDescription}
            onChangeText={fullDescription => setForm(current => ({ ...current, fullDescription }))}
            placeholder="Beskriv arbejdsopgaver, timer om ugen og stillingens omfang"
            multiline
          />
          <View style={styles.actions}>
            <TouchableOpacity style={styles.primaryButton} onPress={saveJob}><Text style={styles.primaryButtonText}>Gem opslag</Text></TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => setEditingId(null)}><Text style={styles.secondaryButtonText}>Annuller</Text></TouchableOpacity>
          </View>
        </View>
      ) : null}

      {!editingId ? (
        <TouchableOpacity style={styles.primaryButtonTop} onPress={startCreate}>
          <Text style={styles.primaryButtonText}>+ Opret nyt jobopslag</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.list}>
        {jobs.map(job => {
          const rating = getRating(job);
          const counts = getApplicationCounts(job);
          const totalApplications = Object.keys(job.applications || {}).length;
          return (
            <View key={job.id} style={styles.jobCard}>
              <Text style={styles.companyName}>{job.company}</Text>
              <Text style={styles.position}>{job.position}</Text>
              <Text style={styles.jobInfo}>{job.jobType || 'Ikke angivet'} · {job.city || 'Ikke angivet'}</Text>
              <Text style={styles.educationLine}>{job.educations.join(' · ')}</Text>
              <Text style={styles.description}>{job.shortDescription}</Text>
              <Text style={styles.rating}>{rating ? `${rating.toFixed(1).replace('.', ',')} stjerner` : 'Ingen bedømmelser'}</Text>
              <Text style={styles.statsTitle}>Ansøgninger: {totalApplications}</Text>
              {counts.map(item => <Text key={item.education} style={styles.statsRow}>{item.education}: {item.count}</Text>)}
              <TouchableOpacity style={styles.secondaryButton} onPress={() => startEdit(job)}>
                <Text style={styles.secondaryButtonText}>Rediger opslag</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteButton} onPress={() => confirmDelete(job)}>
                <Text style={styles.deleteButtonText}>Slet jobopslag</Text>
              </TouchableOpacity>
            </View>
          );
        })}
        {!jobs.length ? <Text style={styles.emptyMessage}>Du har endnu ingen jobopslag.</Text> : null}
      </View>
    </ScrollView>
    {!editingId ? (
      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>Log ud</Text>
      </TouchableOpacity>
    ) : null}
    </SafeAreaView>
  );
}