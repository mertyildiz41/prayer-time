// @ts-nocheck

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import Icon from '@react-native-vector-icons/material-icons';
import { Country, State, City, ICountry, IState, ICity } from 'country-state-city';
import { Location } from '@prayer-time/shared';

import { useTranslation } from '../i18n';

type LocationSearchScreenProps = {
  onLocationSelect: (location: Location) => void;
  initialCountries?: ICountry[];
};

const LocationSearchScreen = ({ onLocationSelect, initialCountries = [] }: LocationSearchScreenProps) => {
  const [step, setStep] = useState<'country' | 'state' | 'city'>('country');
  const [searchQuery, setSearchQuery] = useState('');
  const [countries, setCountries] = useState<ICountry[]>(initialCountries);
  const [states, setStates] = useState<IState[]>([]);
  const [cities, setCities] = useState<ICity[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<ICountry | null>(null);
  const [selectedState, setSelectedState] = useState<IState | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(initialCountries.length === 0);
  const { t } = useTranslation();

  useEffect(() => {
    let isCancelled = false;
    let interactionHandle: { cancel?: () => void } | undefined;

    const loadData = async () => {
      if (step === 'state' && !selectedCountry) {
        setLoading(false);
        setInitializing(false);
        return;
      }
      if (step === 'city' && (!selectedCountry || !selectedState)) {
        setLoading(false);
        setInitializing(false);
        return;
      }

      if (step === 'country' && countries.length > 0) {
        setLoading(false);
        setInitializing(false);
        return;
      }

      setLoading(true);
      try {
        setErrorKey(null);

        if (step === 'country') {
          const result = countries.length > 0 ? countries : Country.getAllCountries();
          if (!isCancelled) {
            setCountries(result ?? []);
          }
        } else if (step === 'state' && selectedCountry) {
          const result = State.getStatesOfCountry(selectedCountry.isoCode);
          if (!isCancelled) {
            setStates(result ?? []);
          }
        } else if (step === 'city' && selectedCountry && selectedState) {
          const result = City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode);
          if (!isCancelled) {
            setCities(result ?? []);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to load location data', err);
          setErrorKey('location.error.load');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
          setInitializing(false);
        }
      }
    };

    interactionHandle = InteractionManager.runAfterInteractions(() => {
      if (!isCancelled) {
        loadData();
      }
    });

    return () => {
      isCancelled = true;
      if (interactionHandle?.cancel) {
        interactionHandle.cancel();
      }
    };
  }, [step, selectedCountry, selectedState, countries.length]);

  const handleSelectCountry = (country: ICountry) => {
    setSelectedCountry(country);
    setSelectedState(null);
    setStates([]);
    setCities([]);
    setStep('state');
    setSearchQuery('');
  };

  const handleSelectState = (state: IState) => {
    setSelectedState(state);
    setCities([]);
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
      setErrorKey('location.error.coordinates');
      return;
    }

    setErrorKey(null);

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
      setCities([]);
      setSearchQuery('');
    } else if (step === 'state') {
      setStep('country');
      setStates([]);
      setSearchQuery('');
    }
  };

  const filteredCountries = countries.filter((country) =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredStates = states.filter((state) =>
    state.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredCities = cities.filter((city) =>
    city.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const renderHeader = () => {
    if (step === 'country') {
      return { title: t('location.title.country'), subtitle: t('location.subtitle.country') };
    }
    if (step === 'state') {
      return { title: t('location.title.state'), subtitle: t('location.subtitle.state', { country: selectedCountry?.name ?? '' }) };
    }
    if (step === 'city') {
      return { title: t('location.title.city'), subtitle: t('location.subtitle.city', { state: selectedState?.name ?? '' }) };
    }
    return { title: t('location.title.country'), subtitle: t('location.subtitle.country') };
  };

  const { title, subtitle } = renderHeader();

  return (
    <View style={styles.safeArea}>
      {initializing && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>{t('location.loading')}</Text>
        </View>
      )}
      <View
        style={[styles.container, initializing && styles.containerHidden]}
        pointerEvents={initializing ? 'none' : 'auto'}
      >
        {step !== 'country' && (
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>

        <View style={styles.searchInputContainer}>
          <Icon name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('location.searchPlaceholder', { step: t(`location.step.${step}`) })}
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {loading && !initializing && (
          <ActivityIndicator size="large" color="#3b82f6" style={styles.inlineLoader} />
        )}
        {errorKey && <Text style={styles.errorText}>{t(errorKey)}</Text>}
        {!loading && !errorKey && (
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
    </View>
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
  loadingContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0e1a',
    zIndex: 2,
  },
  loadingText: {
    marginTop: 12,
    color: '#94a3b8',
    fontSize: 16,
  },
  containerHidden: {
    opacity: 0,
  },
  inlineLoader: {
    marginBottom: 16,
  },
});

export default LocationSearchScreen;
