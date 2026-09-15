import { View, Text, ScrollView } from 'react-native';
import { jobsStyles as styles } from '../styles';

// Midlertidige jobdata, som senere kan erstattes af data fra en backend.
const JOBS = [
  {
    id: 1,
    company: 'Unity Technologies',
    position: 'Junior Software Developer',
    educations: ['ha(IT) - Copenhagen Business School', 'Datamatiker', 'Software Engineering'],
    description: 'Vi søger Junior Software Developers til vores Team i København. Du vil arbejde med Unity-engine og kreative løsninger.',
  },
  {
    id: 2,
    company: 'Microsoft Denmark',
    position: 'IT Support Specialist',
    educations: ['ha(IT) - Copenhagen Business School', 'IT-teknolog', 'Datamatiker'],
    description: 'Bliv del af Microsofts support-team. Du vil hjælpe kunder med tekniske problemstillinger og vores IT-infrastruktur.',
  },
  {
    id: 3,
    company: 'TDC NET',
    position: 'Network Engineer',
    educations: ['ha(IT) - Copenhagen Business School', 'Netværksteknologi', 'Diplomingeniør i IT'],
    description: 'TDC søger dygtige Network Engineers til udvikling og drift af vores IT-netværk og infrastruktur.',
  },
];

export default function JobsScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ledige Jobs</Text>
      </View>

      <View style={styles.jobsList}>
        {JOBS.map((job) => (
          <View key={job.id} style={styles.jobCard}>
            <Text style={styles.company}>{job.company}</Text>
            <Text style={styles.position}>{job.position}</Text>
            <Text style={styles.educationLabel}>Ønskede uddannelser:</Text>
            {/* Tags gør det nemt at sammenligne jobkrav på tværs af opslag. */}
            <View style={styles.educationList}>
              {job.educations.map((education) => (
                <View key={education} style={styles.educationTag}>
                  <Text style={styles.educationText}>{education}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.description}>{job.description}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
