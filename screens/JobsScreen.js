import { useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { jobsStyles as styles } from '../styles';
import { EDUCATIONS, JOB_LOCATIONS, JOB_TYPES, readDatabase, writeDatabase } from '../storage';

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
  const [searchText, setSearchText] = useState('');
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [filters, setFilters] = useState({ jobTypes: [], cities: [], educations: [] });
  const [selectedJobId, setSelectedJobId] = useState(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let isMounted = true;
    readDatabase().then(database => {
      if (isMounted) {
        setJobs(database.jobs);
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

  const searchTerms = searchText.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const searchableJobs = jobs.filter(job => {
    const educations = Array.isArray(job.educations) ? job.educations : [];
    const searchableText = [
      job.position,
      job.company,
      job.jobType,
      job.city,
      ...educations,
      job.shortDescription,
      job.fullDescription,
      job.description,
    ].filter(Boolean).join(' ').toLowerCase();
    return !searchTerms.length || searchTerms.some(term => searchableText.includes(term));
  });
  const visibleJobs = searchableJobs.filter(job => {
    const educations = Array.isArray(job.educations) ? job.educations : [];
    return (!filters.jobTypes.length || filters.jobTypes.includes(job.jobType))
      && (!filters.cities.length || filters.cities.includes(job.city))
      && (!filters.educations.length || filters.educations.some(education => educations.includes(education)));
  });
  const selectedJob = jobs.find(job => job.id === selectedJobId);
  const toggleFilter = (group, value) => {
    setFilters(current => ({
      ...current,
      [group]: current[group].includes(value)
        ? current[group].filter(item => item !== value)
        : [...current[group], value],
    }));
  };
  const clearFilters = () => setFilters({ jobTypes: [], cities: [], educations: [] });

  const renderFilterOptions = (title, group, options) => (
    <View style={styles.filterSection}>
      <Text style={styles.filterSectionTitle}>{title}</Text>
      {options.map(option => {
        const checked = filters[group].includes(option);
        return (
          <TouchableOpacity
            key={option}
            style={styles.filterOption}
            onPress={() => toggleFilter(group, option)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
          >
            <View style={[styles.filterCheckbox, checked && styles.filterCheckboxChecked]}>
              {checked ? <Text style={styles.filterCheckboxCheck}>✓</Text> : null}
            </View>
            <Text style={styles.filterOptionText}>{option}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1f77d2' }} edges={['top']}>
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ledige Jobs</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Søg på stilling, virksomhed, fuldtid, deltid, by, uddannelse eller beskrivelse"
          accessibilityLabel="Søg i jobopslag"
          returnKeyType="search"
        />
      </View>

      <View style={styles.filterButtonRow}>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setFilterModalOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Filtrer jobopslag"
        >
          <Text style={styles.filterButtonText}>Filtrer</Text>
          {Object.values(filters).some(group => group.length > 0) ? (
            <Text style={styles.activeFilterCount}>
              {Object.values(filters).reduce((total, group) => total + group.length, 0)}
            </Text>
          ) : null}
        </TouchableOpacity>
      </View>

      <View style={styles.jobsList}>
        {visibleJobs.map(job => {
          const average = getAverageRating(job.ratings);
          const myRating = job.ratings?.[userId] || 0;

          return (
            <View key={job.id} style={styles.jobCard}>
              <Text style={styles.company}>{job.company}</Text>
              <Text style={styles.position}>{job.position}</Text>
              <Text style={styles.jobInfo}>{job.jobType || 'Ikke angivet'} · {job.city || 'Ikke angivet'}</Text>
              <Text style={styles.educationLabel}>Relevant uddannelse</Text>
              <View style={styles.educationList}>
                <View style={styles.educationTag}>
                  <Text style={styles.educationText}>{job.educations[0]}</Text>
                </View>
              </View>
              <Text style={styles.description}>{job.shortDescription || job.description}</Text>

              <TouchableOpacity style={styles.detailsButton} onPress={() => setSelectedJobId(job.id)}>
                <Text style={styles.detailsButtonText}>Læs hele opslaget</Text>
              </TouchableOpacity>

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
        {!visibleJobs.length && jobs.length ? (
          <Text style={styles.emptyMessage}>Ingen jobopslag matcher din søgning og de valgte filtre.</Text>
        ) : null}
        {!visibleJobs.length && !jobs.length ? (
          <Text style={styles.emptyMessage}>Der er ingen jobopslag endnu.</Text>
        ) : null}
      </View>
    </ScrollView>
    <Modal
      visible={filterModalOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setFilterModalOpen(false)}
    >
      <View style={styles.filterModalOverlay}>
        <View style={styles.filterModal}>
          <Text style={styles.filterModalTitle}>Filtrer jobopslag</Text>
          <ScrollView style={styles.filterModalScroll} keyboardShouldPersistTaps="handled">
            {renderFilterOptions('Arbejdstid', 'jobTypes', JOB_TYPES)}
            {renderFilterOptions('By', 'cities', JOB_LOCATIONS)}
            {renderFilterOptions('Relevant uddannelse', 'educations', EDUCATIONS)}
          </ScrollView>
          <View style={styles.filterModalActions}>
            <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters}>
              <Text style={styles.clearFiltersButtonText}>Fravælg alle</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyFiltersButton} onPress={() => setFilterModalOpen(false)}>
              <Text style={styles.applyFiltersButtonText}>Vis job</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    <Modal
      visible={Boolean(selectedJob)}
      animationType="slide"
      onRequestClose={() => setSelectedJobId(null)}
    >
      <View style={styles.detailScreen}>
        <View style={[styles.detailHeader, { minHeight: 56 + insets.top, paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.detailBackButtonTouch}
            onPress={() => setSelectedJobId(null)}
            hitSlop={10}
            accessibilityRole="button"
          >
            <Text style={styles.detailBackButton}>‹  Tilbage</Text>
          </TouchableOpacity>
          <Text style={styles.detailHeaderTitle}>Jobopslag</Text>
        </View>
        {selectedJob ? (
          <ScrollView contentContainerStyle={styles.detailContent}>
            <Text style={styles.company}>{selectedJob.company}</Text>
            <Text style={styles.position}>{selectedJob.position}</Text>
            <Text style={styles.detailSectionTitle}>Arbejdstid</Text>
            <Text style={styles.detailDescription}>{selectedJob.jobType || 'Ikke angivet'}</Text>
            <Text style={styles.detailSectionTitle}>By</Text>
            <Text style={styles.detailDescription}>{selectedJob.city || 'Ikke angivet'}</Text>
            <Text style={styles.educationLabel}>Relevant uddannelse</Text>
            <View style={styles.educationList}>
              {(selectedJob.educations || []).map(item => (
                <View key={item} style={styles.educationTag}>
                  <Text style={styles.educationText}>{item}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.detailSectionTitle}>Kort beskrivelse</Text>
            <Text style={styles.description}>{selectedJob.shortDescription || selectedJob.description}</Text>
            <Text style={styles.detailSectionTitle}>Uddybende jobbeskrivelse</Text>
            <Text style={styles.detailDescription}>
              {selectedJob.fullDescription || selectedJob.shortDescription || selectedJob.description}
            </Text>
            <Text style={styles.detailRating}>
              {getAverageRating(selectedJob.ratings)
                ? `${getAverageRating(selectedJob.ratings).toFixed(1).replace('.', ',')} stjerner`
                : 'Ingen bedømmelser'}
            </Text>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => {
                const jobId = selectedJob.id;
                setSelectedJobId(null);
                navigation.navigate('Apply', { jobId });
              }}
            >
              <Text style={styles.applyButtonText}>Søg job</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
    </SafeAreaView>
  );
}