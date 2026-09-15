import { View, Text, TextInput, ScrollView, TouchableOpacity } from 'react-native';
import { useState } from 'react';
import { profileStyles as styles } from '../styles';

export default function ProfileScreen() {
  // Formularens samlede state gør det muligt at opdatere felterne ensartet.
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    education: '',
  });

  // Opdaterer kun det felt, brugeren aktuelt skriver i.
  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Nulstiller formularen efter at profilen er gemt lokalt i appen.
  const handleSubmit = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      education: '',
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={styles.container}>
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
            <TextInput
              style={styles.input}
              placeholder="f.eks. ha(IT) - Copenhagen Business School"
              value={formData.education}
              onChangeText={(value) => handleChange('education', value)}
            />
          </View>
        </View>
      </ScrollView>

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
        <Text style={styles.submitButtonText}>Gem Profil</Text>
      </TouchableOpacity>
    </View>
  );
}
