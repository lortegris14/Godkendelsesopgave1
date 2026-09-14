import { View, Text, ScrollView } from 'react-native';
import { jobsStyles as styles } from '../styles';

const JOBS = [
  {
    id: 1,
    company: 'Unity Technologies',
    position: 'Junior Software Developer',
    description: 'Vi søger Junior Software Developers til vores Team i København. Du vil arbejde med Unity-engine og kreative løsninger.',
  },
  {
    id: 2,
    company: 'Microsoft Denmark',
    position: 'IT Support Specialist',
    description: 'Bliv del af Microsofts support-team. Du vil hjælpe kunder med tekniske problemstillinger og vores IT-infrastruktur.',
  },
  {
    id: 3,
    company: 'TDC NET',
    position: 'Network Engineer',
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
            <Text style={styles.description}>{job.description}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
