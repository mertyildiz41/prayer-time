// @ts-nocheck

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Animated,
  Dimensions,
  FlatList,
  PanResponder,
  Easing,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Region, PROVIDER_DEFAULT } from 'react-native-maps';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Icon from '@react-native-vector-icons/material-icons';
import { RootStackParamList } from '../navigation/types';
import { useTranslation } from '../i18n';
import { Location } from '@prayer-time/shared';
import { locationStorage } from '../storage/locationStorage';

type MosqueFinderScreenProps = NativeStackScreenProps<RootStackParamList, 'MosqueFinder'>;

type Mosque = {
  id: string;
  name: string;
  distance: number;
  address: string;
  latitude: number;
  longitude: number;
  imageUrl?: string;
  nextPrayer: string;
  nextPrayerTime: string;
};

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAP_HEIGHT = SCREEN_HEIGHT * 0.65;
const LIST_HEIGHT = SCREEN_HEIGHT * 0.35;
const LIST_MIN_HEIGHT = SCREEN_HEIGHT * 0.25;
const LIST_MAX_HEIGHT = SCREEN_HEIGHT * 0.75;

// Helper function to calculate distance between two coordinates (Haversine formula)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Generate mosques near a location
const generateNearbyMosques = (userLat: number, userLon: number): Mosque[] => {
  const mosqueNames = [
    'Masjid Al-Noor',
    'Islamic Center of Peace',
    'Downtown Community Masjid',
    'Al-Rahman Mosque',
    'Masjid Al-Iman',
    'Islamic Cultural Center',
    'Al-Furqan Mosque',
    'Masjid Al-Huda',
    'Community Islamic Center',
    'Al-Noor Islamic Center',
  ];

  const streetNames = [
    'Faith St',
    'Unity Ave',
    'Central Blvd',
    'Peace Rd',
    'Harmony Ln',
    'Wisdom Way',
    'Guidance St',
    'Light Ave',
    'Truth Blvd',
    'Mercy Rd',
  ];

  const mosques: Mosque[] = [];
  
  // Generate 8-12 mosques in a radius around user location
  const count = 8 + Math.floor(Math.random() * 5);
  
  for (let i = 0; i < count; i++) {
    // Generate random offset within 10km radius
    const angle = Math.random() * 2 * Math.PI;
    const radius = Math.random() * 10; // 0-10 km
    const latOffset = (radius / 111) * Math.cos(angle); // ~111 km per degree latitude
    const lonOffset = (radius / (111 * Math.cos(userLat * Math.PI / 180))) * Math.sin(angle);
    
    const mosqueLat = userLat + latOffset;
    const mosqueLon = userLon + lonOffset;
    const distance = calculateDistance(userLat, userLon, mosqueLat, mosqueLon);
    
    // Only include mosques within 10km
    if (distance <= 10) {
      const name = mosqueNames[i % mosqueNames.length];
      const streetNum = Math.floor(Math.random() * 999) + 1;
      const street = streetNames[i % streetNames.length];
      
      // Calculate next prayer time (random between 5-60 minutes)
      const minutes = Math.floor(Math.random() * 55) + 5;
      const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
      const nextPrayer = prayers[Math.floor(Math.random() * prayers.length)];
      
      mosques.push({
        id: `mosque-${i + 1}`,
        name: `${name}${i > mosqueNames.length - 1 ? ` ${Math.floor(i / mosqueNames.length) + 1}` : ''}`,
        distance: Math.round(distance * 10) / 10,
        address: `${streetNum} ${street}`,
        latitude: mosqueLat,
        longitude: mosqueLon,
        nextPrayer,
        nextPrayerTime: `${minutes} min`,
      });
    }
  }
  
  // Sort by distance
  return mosques.sort((a, b) => a.distance - b.distance);
};

const MosqueFinderScreen: React.FC<MosqueFinderScreenProps> = ({ navigation }) => {
  const { t } = useTranslation();
  const [mosques, setMosques] = useState<Mosque[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [location, setLocation] = useState<Location | null>(null);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [selectedMosque, setSelectedMosque] = useState<Mosque | null>(null);
  const mapRef = useRef<MapView>(null);

  // Animation values - use translateY to slide up from bottom
  const listHeightAnim = useRef(new Animated.Value(LIST_HEIGHT)).current;
  const listTranslateY = useRef(new Animated.Value(LIST_HEIGHT)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const searchBarOpacity = useRef(new Animated.Value(0)).current;
  const listOpacity = useRef(new Animated.Value(0)).current;
  const cardAnimationsRef = useRef<Map<string, Animated.Value>>(new Map());
  const listHeightAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const listTranslateYRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    const loadLocation = async () => {
      const storedLocation = await locationStorage.get();
      setLocation(storedLocation);

      // Set initial map region based on user location
      if (storedLocation) {
        const region = {
          latitude: storedLocation.latitude,
          longitude: storedLocation.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
      setMapRegion(region);
    } else {
      // Default to a known location if no location stored
      setMapRegion({
        latitude: 34.0522,
        longitude: -118.2437,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      });
    }

    // Entrance animations - separate native and non-native animations
    Animated.parallel([
      Animated.timing(headerOpacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(searchBarOpacity, {
        toValue: 1,
        duration: 400,
        delay: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(listOpacity, {
        toValue: 1,
        duration: 500,
        delay: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Slide up animation - start from below screen and slide up
    const slideUpAnimation = Animated.spring(listTranslateY, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    });
    
    listTranslateYRef.current = slideUpAnimation;
    slideUpAnimation.start(() => {
      listTranslateYRef.current = null;
    });

    // Search for mosques automatically when location is available
    const searchMosques = async () => {
      if (!storedLocation) {
        setLoading(false);
        return;
      }

      setLoading(true);
      
      try {
        // In production: Use Google Places API
        // const apiKey = 'YOUR_GOOGLE_PLACES_API_KEY';
        // const response = await fetch(
        //   `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
        //   `location=${storedLocation.latitude},${storedLocation.longitude}` +
        //   `&radius=10000` +
        //   `&type=mosque` +
        //   `&keyword=mosque` +
        //   `&key=${apiKey}`
        // );
        // const data = await response.json();
        // const mosques = data.results.map((place: any, index: number) => ({
        //   id: place.place_id,
        //   name: place.name,
        //   distance: calculateDistance(
        //     storedLocation.latitude,
        //     storedLocation.longitude,
        //     place.geometry.location.lat,
        //     place.geometry.location.lng
        //   ),
        //   address: place.vicinity || place.formatted_address,
        //   latitude: place.geometry.location.lat,
        //   longitude: place.geometry.location.lng,
        //   nextPrayer: 'Asr',
        //   nextPrayerTime: '20 min',
        // }));

        // For now, generate nearby mosques based on user location
        await new Promise((resolve) => setTimeout(resolve, 800));
        const foundMosques = generateNearbyMosques(
          storedLocation.latitude,
          storedLocation.longitude
        );
        
        setMosques(foundMosques);
        setLoading(false);
        
        // Animate cards in
        foundMosques.forEach((mosque, index) => {
          const animValue = new Animated.Value(0);
          cardAnimationsRef.current.set(mosque.id, animValue);
          Animated.timing(animValue, {
            toValue: 1,
            duration: 400,
            delay: index * 80,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        });
      } catch (error) {
        console.error('Error searching for mosques:', error);
        setLoading(false);
        // Fallback to empty or sample data
        setMosques([]);
      }
    };

    // Search mosques when location is ready
    if (storedLocation) {
      searchMosques();
    } else {
      setLoading(false);
    }
    };
  }, []);

  // Filter mosques by search query
  const filteredMosques = useMemo(() => {
    if (!searchQuery.trim()) {
      return mosques;
    }
    const query = searchQuery.toLowerCase();
    return mosques.filter((mosque) =>
      mosque.name.toLowerCase().includes(query) ||
      mosque.address.toLowerCase().includes(query)
    );
  }, [mosques, searchQuery]);

  // Pan responder for dragging bottom panel
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only activate if vertical movement is significant and greater than horizontal
        return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        // Stop any running animations when starting to drag
        if (listTranslateYRef.current) {
          listTranslateYRef.current.stop();
          listTranslateYRef.current = null;
        }
        if (listHeightAnimRef.current) {
          listHeightAnimRef.current.stop();
          listHeightAnimRef.current = null;
        }
      },
      onPanResponderMove: (_, gestureState) => {
        // Stop any running animations during drag
        if (listTranslateYRef.current) {
          listTranslateYRef.current.stop();
          listTranslateYRef.current = null;
        }
        if (listHeightAnimRef.current) {
          listHeightAnimRef.current.stop();
          listHeightAnimRef.current = null;
        }
        
        const currentHeight = listHeightAnim._value || LIST_HEIGHT;
        
        // Only allow dragging up (expanding), not down below initial height
        if (gestureState.dy < 0) {
          // Dragging up - increase height, keep translateY at 0
          const newHeight = Math.min(LIST_MAX_HEIGHT, currentHeight - gestureState.dy);
          listHeightAnim.setValue(newHeight);
          listTranslateY.setValue(0);
        } else {
          // Dragging down - only allow if current height is above initial height
          if (currentHeight > LIST_HEIGHT) {
            const newHeight = Math.max(LIST_HEIGHT, currentHeight - gestureState.dy);
            listHeightAnim.setValue(newHeight);
            listTranslateY.setValue(0);
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const currentHeight = listHeightAnim._value || LIST_HEIGHT;
        let targetHeight = LIST_HEIGHT;
        let targetTranslateY = 0;

        // Only allow expansion upward, never collapse below initial height
        if (gestureState.dy < -50 || currentHeight > LIST_HEIGHT + 100) {
          // Snap to max height if dragged up significantly or already expanded
          targetHeight = LIST_MAX_HEIGHT;
          targetTranslateY = 0;
        } else if (gestureState.dy > 50 && currentHeight > LIST_HEIGHT) {
          // Only allow collapsing if currently expanded and dragged down significantly
          // But never go below initial height
          targetHeight = LIST_HEIGHT;
          targetTranslateY = 0;
        } else {
          // Default: return to initial height
          targetHeight = LIST_HEIGHT;
          targetTranslateY = 0;
        }

        // Ensure we never go below initial height
        targetHeight = Math.max(LIST_HEIGHT, targetHeight);

        const heightAnimation = Animated.spring(listHeightAnim, {
          toValue: targetHeight,
          tension: 50,
          friction: 8,
          useNativeDriver: false, // Height cannot use native driver
        });
        
        const translateYAnimation = Animated.spring(listTranslateY, {
          toValue: targetTranslateY,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        });
        
        listHeightAnimRef.current = heightAnimation;
        listTranslateYRef.current = translateYAnimation;
        
        Animated.parallel([heightAnimation, translateYAnimation]).start(() => {
          listHeightAnimRef.current = null;
          listTranslateYRef.current = null;
        });
      },
    }),
  ).current;

  const handleGetDirections = (mosque: Mosque) => {
    // Center and zoom map on selected mosque
    if (mapRef.current) {
      setSelectedMosque(mosque);
      mapRef.current.animateToRegion({
        latitude: mosque.latitude,
        longitude: mosque.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }, 500);
    }
    // In production: use Linking API to open external maps app
    // Linking.openURL(`https://maps.google.com/?daddr=${mosque.latitude},${mosque.longitude}`);
  };

  const handleMosquePress = (mosque: Mosque) => {
    // Center map on mosque when card is pressed
    handleGetDirections(mosque);
  };

  const handleMarkerPress = (mosque: Mosque) => {
    // Zoom to mosque when marker is pressed
    handleGetDirections(mosque);
  };

  const handleMapRegionChangeComplete = (region: Region) => {
    // Update map region state when user pans/zooms
    setMapRegion(region);
  };

  const handleCenterMap = () => {
    // Center map on user location
    if (location && mapRef.current) {
      setSelectedMosque(null);
      mapRef.current.animateToRegion({
        latitude: location.latitude,
        longitude: location.longitude,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      }, 500);
    } else if (mapRegion && mapRef.current) {
      // If no location, center on current map center
      mapRef.current.animateToRegion(mapRegion, 500);
    }
  };

  const renderMosqueItem = ({ item, index }: { item: Mosque; index: number }) => {
    // Get or create animation value for this mosque
    if (!cardAnimationsRef.current.has(item.id)) {
      const animValue = new Animated.Value(0);
      cardAnimationsRef.current.set(item.id, animValue);
      // Animate in
      Animated.timing(animValue, {
        toValue: 1,
        duration: 400,
        delay: index * 80,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }

    const opacity = cardAnimationsRef.current.get(item.id) || new Animated.Value(1);
    const scale = opacity.interpolate({
      inputRange: [0, 1],
      outputRange: [0.95, 1],
    });
    const translateY = opacity.interpolate({
      inputRange: [0, 1],
      outputRange: [15, 0],
    });

    return (
      <Animated.View
        style={[
          {
            opacity,
            transform: [{ scale }, { translateY }],
          },
        ]}
      >
        <TouchableOpacity 
          style={[
            styles.mosqueCard,
            selectedMosque?.id === item.id && styles.mosqueCardSelected,
          ]}
          activeOpacity={0.85}
          onPress={() => handleMosquePress(item)}
        >
          <View style={styles.mosqueImageContainer}>
            <View style={styles.mosqueImagePlaceholder}>
              <Icon name="mosque" size={40} color="#64748b" />
            </View>
          </View>
          <View style={styles.mosqueInfo}>
            <Text style={styles.mosqueName}>{item.name}</Text>
            <Text style={styles.mosqueDistance}>
              {item.distance.toFixed(1)} km away - {item.address}
            </Text>
            <Text style={styles.mosquePrayerTime}>
              {item.nextPrayer} in {item.nextPrayerTime}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.directionsButton}
            onPress={() => handleGetDirections(item)}
            activeOpacity={0.7}
          >
            <Icon name="navigation" size={24} color="#ffffff" />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Map Section */}
      <View style={styles.mapContainer}>
        {mapRegion ? (
          <MapView
            ref={mapRef}
            provider={PROVIDER_DEFAULT}
            style={styles.map}
            initialRegion={mapRegion}
            region={mapRegion}
            onRegionChangeComplete={handleMapRegionChangeComplete}
            showsUserLocation={true}
            showsMyLocationButton={false}
            mapType="standard"
            zoomEnabled={true}
            zoomControlEnabled={false}
            scrollEnabled={true}
            pitchEnabled={false}
            rotateEnabled={false}
            customMapStyle={[
              {
                elementType: 'geometry',
                stylers: [{ color: '#1e293b' }],
              },
              {
                elementType: 'labels.text.fill',
                stylers: [{ color: '#94a3b8' }],
              },
              {
                elementType: 'labels.text.stroke',
                stylers: [{ color: '#0f172a' }],
              },
              {
                featureType: 'water',
                elementType: 'geometry',
                stylers: [{ color: '#0f172a' }],
              },
              {
                featureType: 'road',
                elementType: 'geometry',
                stylers: [{ color: '#334155' }],
              },
              {
                featureType: 'road',
                elementType: 'labels.text.fill',
                stylers: [{ color: '#64748b' }],
              },
            ]}
          >
            {mosques.map((mosque) => (
              <Marker
                key={mosque.id}
                coordinate={{
                  latitude: mosque.latitude,
                  longitude: mosque.longitude,
                }}
                title={mosque.name}
                description={`${mosque.distance.toFixed(1)} km away - ${mosque.address}`}
                onPress={() => handleMarkerPress(mosque)}
                identifier={mosque.id}
              >
                <Animated.View
                  style={[
                    styles.markerContainer,
                    selectedMosque?.id === mosque.id && styles.markerContainerSelected,
                  ]}
                >
                  <Icon name="mosque" size={24} color="#22c55e" />
                </Animated.View>
              </Marker>
            ))}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.mapPlaceholderText}>
              {t('mosque.loading')}
            </Text>
          </View>
        )}

        {/* Map Controls */}
        <Animated.View style={[styles.mapControls, { opacity: headerOpacity }]}>
          <TouchableOpacity
            style={styles.mapControlButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Icon name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
          <View style={styles.mapTitleContainer}>
            <Text style={styles.mapTitle}>{t('mosque.title')}</Text>
            <Icon name="mosque" size={20} color="#ffffff" />
          </View>
          <TouchableOpacity
            style={styles.mapControlButton}
            onPress={handleCenterMap}
            activeOpacity={0.7}
          >
            <Icon name="my-location" size={24} color="#ffffff" />
          </TouchableOpacity>
        </Animated.View>

        {/* Search Bar */}
        <Animated.View style={[styles.searchBarContainer, { opacity: searchBarOpacity }]}>
          <View style={styles.searchBar}>
            <Icon name="search" size={20} color="#94a3b8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('mosque.searchPlaceholder')}
              placeholderTextColor="#94a3b8"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </Animated.View>
      </View>

      {/* Mosques List */}
      <Animated.View
        style={[
          styles.listContainer,
          {
            height: listHeightAnim,
            transform: [{ translateY: listTranslateY }],
          },
        ]}
      >
        <Animated.View style={[styles.listInnerContainer, { opacity: listOpacity }]}>
          <View style={styles.dragHandleContainer} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
          </View>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>{t('mosque.nearbyTitle')}</Text>
            <TouchableOpacity style={styles.filterButton} activeOpacity={0.7}>
              <Icon name="tune" size={20} color="#ffffff" />
              <Text style={styles.filterButtonText}>{t('mosque.filters')}</Text>
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#38bdf8" />
              <Text style={styles.loadingText}>{t('mosque.loading')}</Text>
            </View>
          ) : (
            <FlatList
              data={filteredMosques}
              renderItem={({ item, index }) => renderMosqueItem({ item, index })}
              keyExtractor={(item) => item.id}
              style={styles.flatList}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              scrollEventThrottle={16}
              nestedScrollEnabled={true}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Icon name="search-off" size={48} color="#64748b" />
                  <Text style={styles.emptyText}>{t('mosque.noResults')}</Text>
                </View>
              }
            />
          )}
        </Animated.View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  mapContainer: {
    height: MAP_HEIGHT,
    backgroundColor: '#1e293b',
    position: 'relative',
  },
  map: {
    flex: 1,
    width: '100%',
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#334155',
  },
  mapPlaceholderText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
  },
  markerContainer: {
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerContainerSelected: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 3,
    borderColor: '#22c55e',
    transform: [{ scale: 1.2 }],
  },
  mapControls: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  mapControlButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  searchBarContainer: {
    position: 'absolute',
    top: 100,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
  },
  listContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  listInnerContainer: {
    flex: 1,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 8,
    paddingBottom: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#64748b',
    borderRadius: 2,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  listTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ffffff',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  filterButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  flatList: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  mosqueCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  mosqueCardSelected: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  mosqueImageContainer: {
    marginRight: 12,
  },
  mosqueImagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mosqueInfo: {
    flex: 1,
  },
  mosqueName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  mosqueDistance: {
    fontSize: 13,
    color: '#94a3b8',
    marginBottom: 4,
  },
  mosquePrayerTime: {
    fontSize: 13,
    color: '#22c55e',
    fontWeight: '600',
  },
  directionsButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 8,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default MosqueFinderScreen;

