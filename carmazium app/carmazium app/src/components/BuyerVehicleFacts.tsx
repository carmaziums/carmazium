import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@/components/BrandIcon';
import { Colors } from '../constants/colors';
import { FontFamily } from '../constants/typography';
import type { NativeMotTest, OfficialVehicleData } from '../data/listings';

const displayDate = (value: unknown): string | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return value;
  const date = new Date(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  if (date.getUTCFullYear() !== +match[1] || date.getUTCMonth() !== +match[2] - 1
      || date.getUTCDate() !== +match[3]) return value;
  return date.toLocaleDateString('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
};
const readable = (value: unknown): string | null => {
  if (value == null || value === '' || (typeof value === 'number' && !Number.isFinite(value))) return null;
  return String(value).replace(/_/g, ' ');
};
const motOdometer = (test: NativeMotTest): string | null => {
  if (test.odometerValue == null || test.odometerValue === '') return null;
  const value = Number(test.odometerValue);
  if (!Number.isFinite(value) || value < 0) return null;
  const unit = (test.odometerUnit ?? '').toUpperCase();
  return value.toLocaleString('en-GB') + (unit === 'KM' ? ' km' : unit === 'MI' || unit === 'MILES' ? ' miles' : ' units (unspecified)');
};

/** Only allowlisted, saved listing facts are rendered. No public DVLA call or guessed trims. */
export function BuyerVehicleFacts({ record }: { record: object | null | undefined }) {
  const [allTests, setAllTests] = useState(false);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);
  if (!record) return null;
  const data = record as Record<string, unknown>;
  const official = data.officialVehicleData && typeof data.officialVehicleData === 'object'
    ? data.officialVehicleData as OfficialVehicleData : undefined;
  const history = (Array.isArray(data.motHistory) ? data.motHistory : [])
    .filter((item): item is NativeMotTest => Boolean(item && typeof item === 'object'
      && typeof item.completedDate === 'string'
      && (item.testResult === 'PASSED' || item.testResult === 'FAILED')))
    .sort((a, b) => b.completedDate.localeCompare(a.completedDate));
  const latestRecorded = history.find(test => motOdometer(test) !== null);
  const groups: Array<{ title: string; entries: Array<[string, unknown]> }> = [
    { title: 'VEHICLE IDENTITY', entries: [
      ['Make', data.make], ['Model', data.model], ['Variant / trim', data.variant],
      ['Registration', data.vrm], ['First registered', data.monthOfFirstRegistration],
      ['First used', displayDate(data.firstUsedDate)], ['Colour', data.color ?? data.colour],
      ['First DVLA registration', official?.dvla?.monthOfFirstDvlaRegistration],
      ['MOT registration date', displayDate(official?.mot?.registrationDate)],
      ['Manufacture date', displayDate(official?.mot?.manufactureDate)],
      ['Secondary colour (MOT)', official?.mot?.secondaryColour],
      ['Body type', data.bodyType ?? data.bodyTypeRaw], ['Drive type', data.driveType],
      ['Doors', data.doors], ['Seats', data.seats], ['Previous owners (seller)', data.owners],
      ['Keys (seller)', data.numberOfKeys],
    ] },
    { title: 'TECHNICAL & EMISSIONS', entries: [
      ['Fuel', data.fuelType], ['Transmission', data.transmission],
      ['Engine (cc)', data.engineSize], ['Power (bhp)', data.bhp],
      ['Euro standard', data.euroStandard],
      ['CO₂ (g/km)', data.co2Emissions], ['Type approval', data.typeApproval],
      ['Wheelplan', data.wheelplan],
      ['Revenue weight (kg)', official?.dvla?.revenueWeight],
      ['Real-driving emissions category', official?.dvla?.realDrivingEmissions],
      ['Automated vehicle (DVLA)', official?.dvla?.automatedVehicle == null ? null : official.dvla.automatedVehicle ? 'Yes' : 'No'],
      ['Torque (Nm)', data.torqueNm], ['Combined MPG', data.combinedMpg],
      ['Extra-urban MPG', data.extraUrbanMpg],
      ['Top speed (mph)', data.topSpeedMph ?? data.topSpeed],
      ['0–60 mph (sec)', data.zeroTo60Mph ?? data.zeroToSixty],
    ] },
    { title: 'DVLA STATUS SNAPSHOT', entries: [
      ['MOT status (saved)', data.motStatus],
      ['MOT expiry (saved)', displayDate(data.motExpiryDate ?? data.motExpiry)],
      ['Tax status (saved)', data.taxStatus],
      ['Tax due (saved)', displayDate(data.taxDueDate)],
      ['Last V5C issued', displayDate(data.dateOfLastV5CIssued)],
      ['Additional vehicle tax rate end', displayDate(official?.dvla?.artEndDate)],
      ['Last MOT test date', displayDate(official?.mot?.lastMotTestDate)],
      ['First MOT due date', displayDate(official?.mot?.motTestDueDate)],
      ['Marked for export (saved)', data.markedForExport == null ? null : data.markedForExport ? 'Yes' : 'No'],
    ] },
    { title: 'SELLER DECLARATIONS', entries: [
      ['Service history (seller)', data.serviceHistory],
      ['Known mechanical issues (seller)', data.mechanicalIssues],
      ['Known electrical issues (seller)', data.electricalIssues],
      ['Write-off category (seller)', data.writeOffCategory && data.writeOffCategory !== 'NONE' ? data.writeOffCategory : null],
    ] },
  ];
  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Ionicons name="list-outline" size={19} color={Colors.infoBlue} />
        <Text style={styles.heading}>FULL VEHICLE INFORMATION</Text>
      </View>
      <Text style={styles.note}>Saved registration-check details and seller information. Fields not supplied are omitted; this is not a live DVLA update or HPI report.</Text>
      {groups.map(group => {
        const entries = group.entries.map(([label, value]) => [label, readable(value)] as const)
          .filter((entry): entry is readonly [string, string] => entry[1] !== null);
        if (!entries.length) return null;
        return (
          <View key={group.title} style={styles.card}>
            <Text style={styles.subheading}>{group.title}</Text>
            {entries.map(([label, value]) => (
              <View key={label} style={styles.row}>
                <Text style={styles.key}>{label}</Text>
                <Text style={styles.value}>{value}</Text>
              </View>
            ))}
          </View>
        );
      })}
      <View style={styles.card}>
        <Text style={styles.subheading}>MOT TEST HISTORY</Text>
        <Text style={styles.note}>Saved test results and original odometer readings. Historical MOT mileage is not the seller's current mileage.</Text>
        {latestRecorded && (
          <View style={styles.highlight}>
            <Text style={styles.highlightTitle}>LATEST RECORDED MOT ODOMETER</Text>
            <Text style={styles.highlightValue}>{motOdometer(latestRecorded)}</Text>
            <Text style={styles.note}>Recorded {displayDate(latestRecorded.completedDate)}</Text>
          </View>
        )}
        {history.length === 0 && <Text style={styles.note}>No MOT history was saved with this listing. This does not mean no MOT tests exist.</Text>}
        {(allTests ? history : history.slice(0, 5)).map((test, index) => {
          const key = test.motTestNumber || test.completedDate + '-' + index;
          const expanded = expandedTest === key;
          const defects = Array.isArray(test.defects) ? test.defects.filter(d => d && typeof d.text === 'string') : [];
          const passed = test.testResult === 'PASSED';
          return (
            <View key={key} style={styles.test}>
              <TouchableOpacity style={styles.testHeader} onPress={() => setExpandedTest(expanded ? null : key)}
                accessibilityRole="button" accessibilityState={{ expanded }}
                accessibilityLabel={test.testResult + ' MOT test ' + (displayDate(test.completedDate) ?? '')}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.result, { color: passed ? Colors.success : Colors.error }]}>
                    {passed ? 'PASSED' : 'FAILED'} · {displayDate(test.completedDate)}
                  </Text>
                  <Text style={styles.note}>{motOdometer(test) || 'Odometer unavailable'} · {defects.length} recorded advisory/defect item(s)</Text>
                </View>
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={Colors.textSecondary}/>
              </TouchableOpacity>
              {expanded && (
                <View style={styles.defects}>
                  {!!test.expiryDate && <Text style={styles.note}>Test expiry: {displayDate(test.expiryDate)}</Text>}
                  {!!test.motTestNumber && <Text style={styles.note}>MOT reference: {test.motTestNumber}</Text>}
                  {!!test.odometerResultType && <Text style={styles.note}>Odometer reading status: {test.odometerResultType}</Text>}
                  {!defects.length && <Text style={styles.note}>No individual defect text was saved for this test.</Text>}
                  {defects.map((defect, i) => (
                    <View key={i} style={styles.defect}>
                      <Text style={[styles.defectType, { color: defect.type === 'MAJOR' || defect.type === 'DANGEROUS' ? Colors.error : Colors.warning }]}>
                        {defect.type}
                      </Text>
                      <Text style={styles.value}>{defect.text}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
        {history.length > 5 && <TouchableOpacity style={styles.more} accessibilityRole="button"
          onPress={() => setAllTests(previous => !previous)}>
          <Text style={styles.moreText}>{allTests ? 'Show recent five tests' : 'Show all ' + history.length + ' MOT tests'}</Text>
        </TouchableOpacity>}
        <Text style={styles.note}>MOT and tax statuses can change after the listing was created. Check the official government record.</Text>
        <TouchableOpacity accessibilityRole="link" style={styles.more} onPress={() => Linking.openURL('https://www.gov.uk/check-mot-history')}>
          <Text style={styles.moreText}>Check MOT history on GOV.UK</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { gap: 12, marginVertical: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { color: Colors.textPrimary, fontFamily: FontFamily.extraBold, fontSize: 16 },
  card: { backgroundColor: Colors.bgCard, borderRadius: 14, borderWidth: 1,
    borderColor: Colors.borderSubtle, padding: 15, gap: 8 },
  subheading: { color: Colors.textPrimary, fontFamily: FontFamily.extraBold, fontSize: 13 },
  note: { color: Colors.textMuted, fontSize: 11, lineHeight: 17 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.borderSubtle },
  key: { flex: 1, color: Colors.textSecondary, fontSize: 12 },
  value: { flex: 1, color: Colors.textPrimary, fontSize: 12, fontFamily: FontFamily.bold, textAlign: 'right' },
  highlight: { backgroundColor: Colors.bgElevated, borderRadius: 9, padding: 12, gap: 4 },
  highlightTitle: { color: Colors.success, fontFamily: FontFamily.bold, fontSize: 10 },
  highlightValue: { color: Colors.textPrimary, fontFamily: FontFamily.extraBold, fontSize: 21 },
  test: { borderWidth: 1, borderColor: Colors.borderSubtle, borderRadius: 10, padding: 11, gap: 8 },
  testHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 45 },
  result: { fontFamily: FontFamily.bold, fontSize: 12, marginBottom: 4 },
  defects: { gap: 7, borderTopWidth: 1, borderTopColor: Colors.borderSubtle, paddingTop: 10 },
  defect: { backgroundColor: Colors.bgElevated, borderRadius: 8, padding: 9, gap: 4 },
  defectType: { fontFamily: FontFamily.extraBold, fontSize: 11 },
  more: { minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 9,
    borderWidth: 1, borderColor: Colors.infoBlue, paddingHorizontal: 12 },
  moreText: { color: Colors.infoBlue, fontFamily: FontFamily.bold, fontSize: 12 },
});
