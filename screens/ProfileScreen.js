import { Alert, View, Text, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { profileStyles as styles } from '../styles';
import { EDUCATIONS, readDatabase, writeDatabase } from '../storage';

// Viser og gemmer den aktive jobsøgers profiloplysninger.
export default function ProfileScreen({ userId, onLogout }) {
  // Formularens samlede state gør det muligt at opdatere felterne ensartet.
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    education: '',
  });
  const [isEducationMenuOpen, setIsEducationMenuOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    readDatabase().then(database => {
      if (isMounted) {
        setFormData(database.profiles[userId] || { name: '', email: '', phone: '', education: '' });
      }
    });
    return () => { isMounted = false; };
  }, [userId]);

  // Opdaterer kun det felt, brugeren aktuelt skriver i.
  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Gemmer profilens felter på den aktive brugers konto.
  const handleSubmit = async () => {
    try {
      const database = await readDatabase();
      database.profiles[userId] = formData;
      await writeDatabase(database);
      Alert.alert('Profil gemt', 'Dine profiloplysninger er gemt.');
    } catch {
      Alert.alert('Kunne ikke gemme', 'Prøv igen om et øjeblik.');
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#1f77d2' }} edges={['top']}>
      <ScrollView
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <View style={styles.header}>
          <Text style={styles.title}>Min Profil</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.formGroup}>
            <Text style={styles.label}>Navn</Text>
            <TextInput
              style={styles.input}
              placeholder="Skriv dit navn"
              value={formData.name}
              onChangeText={(value) => handleChange('name', value)}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="Skriv din email"
              value={formData.email}
              onChangeText={(value) => handleChange('email', value)}
              keyboardType="email-address"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Telefon</Text>
            <TextInput
              style={styles.input}
              placeholder="Skriv dit telefonnummer"
              value={formData.phone}
              onChangeText={(value) => handleChange('phone', value)}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Uddannelse</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setIsEducationMenuOpen(value => !value)}
            >
              <Text style={formData.education ? styles.dropdownText : styles.dropdownPlaceholder}>
                {formData.education || 'Vælg uddannelse'}
              </Text>
              <Text style={styles.dropdownArrow}>{isEducationMenuOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {isEducationMenuOpen && EDUCATIONS.map(education => (
              <TouchableOpacity
                key={education}
                style={styles.dropdownOption}
                onPress={() => {
                  handleChange('education', education);
                  setIsEducationMenuOpen(false);
                }}
              >
                <Text style={styles.dropdownText}>{education}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>Gem Profil</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutButtonText}>Log ud</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
