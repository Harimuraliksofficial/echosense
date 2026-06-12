import React from 'react';
import { View, Text, Image, StyleSheet, ScrollView } from 'react-native';

const SYMBOL_ASSETS = {
  angry: require('../assets/images/symbols/angry.png'),
  body: require('../assets/images/symbols/body.png'),
  come: require('../assets/images/symbols/come.png'),
  comehere: require('../assets/images/symbols/comehere.jpeg'),
  doctor: require('../assets/images/symbols/doctor.png'),
  drink: require('../assets/images/symbols/drink.png'),
  eat: require('../assets/images/symbols/eat.png'),
  food: require('../assets/images/symbols/food.png'),
  go: require('../assets/images/symbols/go.png'),
  happy: require('../assets/images/symbols/happy.png'),
  head: require('../assets/images/symbols/head.webp'),
  hello: require('../assets/images/symbols/hello.png'),
  help: require('../assets/images/symbols/help.png'),
  home: require('../assets/images/symbols/home.png'),
  hospital: require('../assets/images/symbols/hospital.png'),
  how: require('../assets/images/symbols/how.png'),
  hungry: require('../assets/images/symbols/hungry.jpeg'),
  i: require('../assets/images/symbols/i.jpeg'),
  medicine: require('../assets/images/symbols/medicine.png'),
  pain: require('../assets/images/symbols/pain.webp'),
  sad: require('../assets/images/symbols/sad.png'),
  scared: require('../assets/images/symbols/scared.png'),
  sick: require('../assets/images/symbols/sick.png'),
  sit: require('../assets/images/symbols/sit.png'),
  sleep: require('../assets/images/symbols/sleep.jpeg'),
  stomach: null, // .avif not supported by React Native
  thirsty: require('../assets/images/symbols/thirsty.png'),
  tired: null, // .avif not supported by React Native
  toilet: require('../assets/images/symbols/toilet.png'),
  walk: require('../assets/images/symbols/walk.png'),
  water: require('../assets/images/symbols/water.png'),
  where: require('../assets/images/symbols/where.png'),
  why: require('../assets/images/symbols/why.jpeg'),
  you: require('../assets/images/symbols/you.png'),
};

export default function SymbolGrid({ symbols }) {
  if (!symbols || symbols.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>VISUAL ASSIST</Text>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {symbols.map((symbol, index) => (
          <View key={`${symbol}-${index}`} style={styles.symbolCard}>
            {SYMBOL_ASSETS[symbol] ? (
              <Image source={SYMBOL_ASSETS[symbol]} style={styles.symbolImage} />
            ) : (
              <View style={styles.placeholderSymbol}>
                <Text style={styles.placeholderText}>{symbol.toUpperCase()}</Text>
              </View>
            )}
            <Text style={styles.symbolLabel}>{symbol}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 15,
    paddingVertical: 10,
  },
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginLeft: 5,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 10,
  },
  symbolCard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 20,
    width: 110,
    marginRight: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  symbolImage: {
    width: 70,
    height: 70,
    borderRadius: 12,
    marginBottom: 8,
  },
  symbolLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'capitalize',
  },
  placeholderSymbol: {
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    textAlign: 'center',
  },
});
