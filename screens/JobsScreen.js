import { useEffect, useState } from 'react';
import { Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { jobsStyles as styles } from '../styles';
import { readDatabase, writeDatabase } from '../storage';

// Beregner gennemsnittet af en listes bedømmelser.
function getAverageRating(ratings) {
  const values = Object.values(ratings || {}).filter(value => Number.isFinite(value));
  return values.length
    ? values.reduce((total, value) => total + value, 0) / values.length
    : 0;
}

// Viser jobopslag, uddannelsesfilter og bedømmelser for jobsøgeren.
export default function JobsScreen({ userId, navigation }) {
  const [jobs, setJobs] = useState([]);
  const [education, setEducation] = useState('');
  const [relevantOnly, setRelevantOnly] = useState(false);

  useEffect(() => {
    let isMounted = true;
    readDatabase().then(database => {
      if (isMounted) {
        setJobs(database.jobs);
        setEducation(database.profiles[userId]?.education || '');
      }
    });
    return () => { isMounted = false; };
  }, [userId]);

  // Gemmer brugerens bedømmelse af et job.
  const handleRate = async (jobId, rating) => {
    try {
      const database = await readDatabase();
      const updatedJobs = database.jobs.map(job => ({
        ...job,
        ratings: job.ratings || {},
      }));
      const job = updatedJobs.find(item => item.id === jobId);
      if (!job) return;
      job.ratings[userId] = rating;
      database.jobs = updatedJobs;
      await writeDatabase(database);
      setJobs(updatedJobs);
    } catch {
      Alert.alert('Kunne ikke gemme', 'Din bedømmelse blev ikke gemt. Prøv igen.');
    }
  };

  const visibleJobs = relevantOnly && education
    ? jobs.filter(job => job.educations.includes(education))
    : jobs;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1f77d2' }} edges={['top']}>
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ledige Jobs</Text>
      </View>

      <View style={styles.filterRow}>
        <Text style={styles.filterLabel}>Vis kun relevante for mig</Text>
        <Switch
          value={relevantOnly}
          onValueChange={setRelevantOnly}
          style={{ transform: [{ translateY: 11 }] }}
          trackColor={{ false: '#c8cdd2', true: '#8bbbe8' }}
          thumbColor={relevantOnly ? '#1f77d2' : '#f4f4f4'}
          accessibilityLabel="Filtrer relevante jobs"
        />
      </View>

      {relevantOnly && !education ? (
        <Text style={styles.emptyMessage}>Vælg din uddannelse på profilsiden for at filtrere jobs.</Text>
      ) : null}

      <View style={styles.jobsList}>
        {visibleJobs.map(job => {
          const average = getAverageRating(job.ratings);
          const myRating = job.ratings?.[userId] || 0;

          return (
            <View key={job.id} style={styles.jobCard}>
              <Text style={styles.company}>{job.company}</Text>
              <Text style={styles.position}>{job.position}</Text>
              <Text style={styles.educationLabel}>Relevant uddannelse</Text>
              <View style={styles.educationList}>
                <View style={styles.educationTag}>
                  <Text style={styles.educationText}>{job.educations[0]}</Text>
                </View>
              </View>
              <Text style={styles.description}>{job.description}</Text>

              <TouchableOpacity style={styles.applyButton} onPress={() => navigation.navigate('Apply', { jobId: job.id })}>
                <Text style={styles.applyButtonText}>Søg job</Text>
              </TouchableOpacity>

              <View style={styles.ratingSection}>
                <Text style={styles.ratingPrompt}>Bedøm jobbet</Text>
                <View style={styles.ratingInput}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <TouchableOpacity
                      key={star}
                      style={styles.starButton}
                      onPress={() => handleRate(job.id, star)}
                      accessibilityLabel={`Bedøm ${star} ud af 5 stjerner`}
                    >
                      <Text style={[styles.inputStar, star <= myRating && styles.selectedStar]}>★</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.averageRating}>
                <View style={styles.averageStars}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <View key={star} style={styles.averageStarWrap}>
                      <Text style={styles.averageStar}>★</Text>
                      <View style={[styles.averageStarFill, { width: `${Math.max(0, Math.min(1, average - star + 1)) * 100}%` }]}>
                        <Text style={styles.averageStarFilled}>★</Text>
                      </View>
                    </View>
                  ))}
                </View>
                <Text style={styles.ratingText}>
                  {average ? `${average.toFixed(1).replace('.', ',')} stjerner` : 'Ingen bedømmelser'}
                </Text>
              </View>
            </View>
          );
        })}
        {!visibleJobs.length && !relevantOnly ? (
          <Text style={styles.emptyMessage}>Der er ingen jobopslag endnu.</Text>
        ) : null}
        {!visibleJobs.length && relevantOnly && education ? (
          <Text style={styles.emptyMessage}>Ingen jobopslag matcher din uddannelse endnu.</Text>
        ) : null}
      </View>
    </ScrollView>
    </SafeAreaView>
  );
}