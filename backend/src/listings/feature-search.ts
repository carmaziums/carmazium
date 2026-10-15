/** Feature search uses case-sensitive PostgreSQL JSON array membership.
 * Map only genuine equivalent labels from older imports/forms; do not silently
 * broaden a specific requested feature to unrelated equipment.
 */
const EQUIVALENT_FEATURE_LABELS: string[][] = [
  [
    "Navigation",
    "Sat Nav",
    "Satellite Navigation",
    "GPS Navigation"
  ],
  [
    "Bluetooth",
    "Bluetooth / Hands Free",
    "Bluetooth Hands-Free",
    "Bluetooth Hands Free"
  ],
  [
    "Reverse Camera",
    "Reversing Camera",
    "Rear View Camera",
    "Rear-View Camera",
    "Rear Camera"
  ],
  [
    "360 Camera",
    "360° Camera",
    "Surround View Camera",
    "Surround Camera"
  ],
  [
    "Parking Sensors",
    "Front and Rear Parking Sensors",
    "Parking Sensors (Front)",
    "Parking Sensors (Rear)"
  ],
  [
    "Front Parking Sensors",
    "Parking Sensors (Front)",
    "Front and Rear Parking Sensors"
  ],
  [
    "Rear Parking Sensors",
    "Parking Sensors (Rear)",
    "Front and Rear Parking Sensors"
  ],
  [
    "Electric Tailgate",
    "Power Tailgate",
    "Powered Tailgate"
  ],
  [
    "Wireless Phone Charging",
    "Wireless Charging",
    "Wireless Smartphone Charging"
  ],
  [
    "ISOFIX",
    "ISOFIX Child Seat Mounts",
    "ISOFIX Points"
  ],
  [
    "LED Headlights",
    "LED Headlamps"
  ],
  [
    "Lane Assist",
    "Lane Keep Assist",
    "Lane Keeping Assist"
  ],
  [
    "Electronic Stability Control",
    "ESP",
    "ESC",
    "Stability Control"
  ],
  [
    "Tyre Pressure Monitoring",
    "TPMS",
    "Tyre Pressure Monitoring System"
  ],
  [
    "Power-Folding Mirrors",
    "Electric Folding Mirrors",
    "Folding Mirrors"
  ],
  [
    "Panoramic Roof",
    "Panoramic Sunroof"
  ],
  [
    "Electric Seats",
    "Electric Front Seats",
    "Electrically Adjustable Seats"
  ],
  [
    "Heated Seats",
    "Heated Front Seats"
  ],
  [
    "Climate Control",
    "Automatic Climate Control"
  ],
  [
    "Front Fog Lights",
    "Fog Lights"
  ],
  [
    "Rear Entertainment",
    "Rear Seat Entertainment"
  ]
];

export function buildFeatureConditions(selected: string[]) {
  return selected.filter(Boolean).map(feature => {
    const equivalents = EQUIVALENT_FEATURE_LABELS.find(labels =>
      labels.some(label => label.toLowerCase() === feature.toLowerCase())
    );
    const options = Array.from(new Set([feature, ...(equivalents || [])]));
    return { OR: options.map(value => ({ features: { array_contains: [value] } })) };
  });
}
