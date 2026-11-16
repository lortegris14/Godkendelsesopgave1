import { Alert, Image, View, Text, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { useEffect, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { profileStyles as styles } from '../styles';
import { EDUCATIONS, readDatabase, writeDatabase } from '../storage';

const SEMESTERS = [
  ...Array.from({ length: 6 }, (_, index) => ({ value: String(index + 1), label: `${index + 1}. semester` })),
  { value: 'completed', label: 'Uddannelsen er færdiggjort' },
];

// Viser og gemmer den aktive jobsøgers profiloplysninger.
export default function ProfileScreen({ userId, onLogout }) {
  // Formularens samlede state gør det muligt at opdatere felterne ensartet.
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    education: '',
    semester: '',
    cv: null,
    photo: null,
  });
  const [isEducationMenuOpen, setIsEducationMenuOpen] = useState(false);
  const [isSemesterMenuOpen, setIsSemesterMenuOpen] = useState(false);
  const [isCvPending, setIsCvPending] = useState(false);
  const [isPhotoPending, setIsPhotoPending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    readDatabase().then(database => {
      if (isMounted) {
        const profile = database.profiles[userId] || {};
        setFormData({
          name: '',
          email: '',
          phone: '',
          education: '',
          semester: '',
          ...profile,
          cv: profile.cv || null,
          photo: profile.photo || null,
        });
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

  const chooseCv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const cv = result.assets?.[0];
      if (!cv) return;
      if (cv.mimeType !== 'application/pdf' && !cv.name.toLowerCase().endsWith('.pdf')) {
        Alert.alert('Vælg en PDF', 'Dit CV skal være en PDF-fil.');
        return;
      }

      handleChange('cv', { name: cv.name, uri: cv.uri, mimeType: 'application/pdf' });
      setIsCvPending(true);
    } catch {
      Alert.alert('Kunne ikke åbne filer', 'Prøv at vælge dit CV igen.');
    }
  };

  const choosePhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Adgang til billeder', 'Giv appen adgang til dine billeder for at vælge et profilbillede.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled) return;

      const photo = result.assets?.[0];
      if (!photo) return;
      const extension = photo.mimeType?.split('/')[1] || 'jpeg';
      handleChange('photo', {
        uri: photo.uri,
        fileName: photo.fileName || `profilbillede.${extension}`,
        mimeType: photo.mimeType || 'image/jpeg',
      });
      setIsPhotoPending(true);
    } catch {
      Alert.alert('Kunne ikke vælge billede', 'Prøv at vælge et profilbillede igen.');
    }
  };

  // Gemmer profilens felter på den aktive brugers konto.
  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const database = await readDatabase();
      let profile = formData;
      if (isCvPending && formData.cv) {
        const cvDirectory = `${FileSystem.documentDirectory}profile-cvs/`;
        await FileSystem.makeDirectoryAsync(cvDirectory, { intermediates: true });
        const safeName = formData.cv.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const destination = `${cvDirectory}${userId}-${Date.now()}-${safeName}`;
        await FileSystem.copyAsync({ from: formData.cv.uri, to: destination });
        profile = { ...formData, cv: { ...formData.cv, uri: destination } };
      }
      if (isPhotoPending && formData.photo) {
        const photoDirectory = `${FileSystem.documentDirectory}profile-photos/`;
        await FileSystem.makeDirectoryAsync(photoDirectory, { intermediates: true });
        const extension = formData.photo.fileName.split('.').pop()?.toLowerCase() || 'jpg';
        const safeExtension = /^[a-z0-9]+$/.test(extension) ? extension : 'jpg';
        const destination = `${photoDirectory}${userId}-${Date.now()}.${safeExtension}`;
        await FileSystem.copyAsync({ from: formData.photo.uri, to: destination });
        profile = { ...profile, photo: { ...formData.photo, uri: destination } };
      }
      database.profiles[userId] = profile;
      await writeDatabase(database);
      setFormData(profile);
      setIsCvPending(false);
      setIsPhotoPending(false);
      Alert.alert('Profil gemt', 'Dine profiloplysninger er gemt.');
    } catch {
      Alert.alert('Kunne ikke gemme', 'Prøv igen om et øjeblik.');
    } finally {
      setIsSaving(false);
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
            <Text style={styles.label}>Profilbillede</Text>
            {formData.photo?.uri ? (
              <Image source={{ uri: formData.photo.uri }} style={styles.profilePhoto} />
            ) : null}
            <TouchableOpacity style={styles.cvButton} onPress={choosePhoto} disabled={isSaving}>
              <Text style={styles.cvButtonText}>{formData.photo ? 'Skift profilbillede' : 'Vælg profilbillede'}</Text>
            </TouchableOpacity>
            {isPhotoPending ? <Text style={styles.cvHint}>Gem profilen for at gemme det nye billede.</Text> : null}
          </View>

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

          <View style={styles.formGroup}>
            <Text style={styles.label}>Aktuelt semester</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setIsSemesterMenuOpen(value => !value)}
            >
              <Text style={formData.semester ? styles.dropdownText : styles.dropdownPlaceholder}>
                {SEMESTERS.find(semester => semester.value === formData.semester)?.label || 'Vælg semester'}
              </Text>
              <Text style={styles.dropdownArrow}>{isSemesterMenuOpen ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {isSemesterMenuOpen && SEMESTERS.map(semester => (
              <TouchableOpacity
                key={semester.value}
                style={styles.dropdownOption}
                onPress={() => {
                  handleChange('semester', semester.value);
                  setIsSemesterMenuOpen(false);
                }}
              >
                <Text style={styles.dropdownText}>{semester.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Personligt CV</Text>
            <Text style={styles.cvName}>
              {formData.cv?.name || 'Intet CV valgt'}
            </Text>
            <TouchableOpacity style={styles.cvButton} onPress={chooseCv} disabled={isSaving}>
              <Text style={styles.cvButtonText}>{formData.cv ? 'Skift CV' : 'Vælg CV (PDF)'}</Text>
            </TouchableOpacity>
            {isCvPending ? <Text style={styles.cvHint}>Gem profilen for at gemme det nye CV.</Text> : null}
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={isSaving}>
        <Text style={styles.submitButtonText}>{isSaving ? 'Gemmer...' : 'Gem Profil'}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutButtonText}>Log ud</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}
