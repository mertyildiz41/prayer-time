import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '@react-native-vector-icons/material-icons';
import { Country, State, City, ICountry, IState, ICity } from 'country-state-city';
import { Location } from '@prayer-time/shared';

type LocationSearchScreenProps = {
  onLocationSelect: (location: Location) => void;
};

const LocationSearchScreen = ({ onLocationSelect }: LocationSearchScreenProps) => {
  const [step, setStep] = useState<'country' | 'state' | 'city'>('country');
  const [searchQuery, setSearchQuery] = useState('');
  const [countries, setCountries] = useState<ICountry[]>([]);
  const [states, setStates] = useState<IState[]>([]);
  const [cities, setCities] = useState<ICity[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<ICountry | null>(null);
  const [selectedState, setSelectedState] = useState<IState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (step === 'country') {
      setCountries(Country.getAllCountries());
    } else if (step === 'state' && selectedCountry) {
      setStates(State.getStatesOfCountry(selectedCountry.isoCode));
    } else if (step === 'city' && selectedCountry && selectedState) {
      setCities(City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode));
    }
  }, [step, selectedCountry, selectedState]);

  const handleSelectCountry = (country: ICountry) => {
    setSelectedCountry(country);
    setStep('state');
    setSearchQuery('');
  };

  const handleSelectState = (state: IState) => {
    setSelectedState(state);
    setStep('city');
    setSearchQuery('');
  };

  const handleSelectCity = (city: ICity) => {
    if (!selectedCountry) {
      return;
    }

    const latitudeValue = city.latitude ?? '';
    const longitudeValue = city.longitude ?? '';

    const latitude = Number.parseFloat(latitudeValue);
    const longitude = Number.parseFloat(longitudeValue);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setError('Selected city is missing coordinate data.');
      return;
    }

    setError(null);

    const location: Location = {
      city: city.name,
      country: selectedCountry.name,
      latitude,
      longitude,
      timezone: selectedCountry.timezones?.[0]?.zoneName ?? 'UTC',
    };

    onLocationSelect(location);
  };

  const handleBack = () => {
    if (step === 'city') {
      setStep('state');
      setSearchQuery('');
    } else if (step === 'state') {
      setStep('country');
      setSearchQuery('');
    }
  };

  const filteredCountries = countries.filter((country) =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredStates = states.filter((state) =>
    state.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCities = cities.filter((city) =>
    city.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderHeader = () => {
    if (step === 'country') {
      return { title: 'Select a Country', subtitle: 'Please select your country.' };
    }
    if (step === 'state') {
      return { title: 'Select a State/Region', subtitle: `You selected ${selectedCountry?.name}.` };
    }
    if (step === 'city') {
      return { title: 'Select a City', subtitle: `You selected ${selectedState?.name}.` };
    }
    return { title: 'Where are you located?', subtitle: 'Please enter your city to get accurate prayer times.' };
  };

  const { title, subtitle } = renderHeader();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {step !== 'country' && (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.searchInputContainer}>
          <Icon name="search-outline" size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search for a ${step}...`}
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {loading && <ActivityIndicator size="large" color="#3b82f6" />}
        {error && <Text style={styles.errorText}>{error}</Text>}
        {!loading && !error && (
          <>
            {step === 'country' && (
              <FlatList<ICountry>
                data={filteredCountries}
                keyExtractor={(item: ICountry) => item.isoCode}
                renderItem={({ item }: { item: ICountry }) => (
                  <TouchableOpacity style={styles.optionRow} onPress={() => handleSelectCountry(item)}>
                    <Text style={styles.locationText}>{`${item.name} ${item.flag}`}</Text>
                    <Icon name="arrow-forward" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              />
            )}
            {step === 'state' && (
              <FlatList<IState>
                data={filteredStates}
                keyExtractor={(item: IState) => item.isoCode}
                renderItem={({ item }: { item: IState }) => (
                  <TouchableOpacity style={styles.optionRow} onPress={() => handleSelectState(item)}>
                    <Text style={styles.locationText}>{item.name}</Text>
                    <Icon name="arrow-forward" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              />
            )}
            {step === 'city' && (
              <FlatList<ICity>
                data={filteredCities}
                keyExtractor={(item: ICity) => item.name}
                renderItem={({ item }: { item: ICity }) => (
                  <TouchableOpacity style={styles.optionRow} onPress={() => handleSelectCity(item)}>
                    <Text style={styles.locationText}>{item.name}</Text>
                    <Icon name="arrow-forward" size={20} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              />
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  backButton: {
    position: 'absolute',
    top: 40,
    left: 24,
    zIndex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 32,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    height: 50,
    color: '#ffffff',
    fontSize: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  locationText: {
    color: '#ffffff',
    fontSize: 16,
    marginLeft: 16,
    flex: 1,
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginBottom: 10,
  },
});

export default LocationSearchScreen;
