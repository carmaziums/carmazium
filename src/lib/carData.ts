/**
 * Comprehensive UK car make/model/variant database.
 * Models and trims are the most common variants sold in the UK market.
 */
export const CAR_MAKES: string[] = [
  'Alfa Romeo', 'Aston Martin', 'Audi', 'Bentley', 'BMW', 'Bugatti',
  'Chevrolet', 'Chrysler', 'Citroën', 'Cupra', 'Dacia', 'DS',
  'Ferrari', 'Fiat', 'Ford', 'Honda', 'Hyundai', 'Infiniti',
  'Jaguar', 'Jeep', 'Kia', 'Lamborghini', 'Land Rover', 'Lexus',
  'Maserati', 'Mazda', 'McLaren', 'Mercedes-Benz', 'MG', 'MINI',
  'Mitsubishi', 'Morgan', 'Nissan', 'Peugeot', 'Porsche', 'Renault',
  'Rolls-Royce', 'SEAT', 'Skoda', 'Smart', 'Subaru', 'Suzuki',
  'Tesla', 'Toyota', 'Vauxhall', 'Volkswagen', 'Volvo',
  'BYD', 'Lynk & Co', 'Omoda', 'Jaecoo', 'GWM ORA', 'Leapmotor',
]

export const MODELS_BY_MAKE: Record<string, string[]> = {
  'Alfa Romeo': ['Giulia', 'Giulietta', 'Stelvio', 'Tonale', '4C', 'MiTo', 'Brera', '159', '156', '147', '166', 'Spider', 'GTV', 'Junior'],
  'Aston Martin': ['DB11', 'DB12', 'Vantage', 'DBS', 'DBX', 'DBX707', 'Rapide', 'Vanquish', 'DB9', 'Cygnet'],
  'Audi': [
    'A1', 'A2', 'A3', 'A3 Sportback', 'A4', 'A4 Avant', 'A4 Allroad', 'A5', 'A5 Sportback', 'A6', 'A6 Avant', 'A6 Allroad', 'A7', 'A8',
    'Q2', 'Q3', 'Q3 Sportback', 'Q4 e-tron', 'Q4 Sportback e-tron', 'Q5', 'Q5 Sportback', 'Q7', 'Q8', 'Q8 e-tron',
    'TT', 'TTS', 'TT RS',
    'R8',
    'e-tron', 'e-tron GT', 'e-tron Sportback',
    'RS3', 'RS4', 'RS4 Avant', 'RS5', 'RS5 Sportback', 'RS6 Avant', 'RS7',
    'S3', 'S4', 'S4 Avant', 'S5', 'S5 Sportback', 'S6', 'S6 Avant', 'S7', 'S8',
  ],
  'Bentley': ['Continental GT', 'Continental GT Speed', 'Continental GTC', 'Bentayga', 'Bentayga EWB', 'Flying Spur', 'Mulsanne'],
  'BMW': [
    '1 Series', '2 Series', '2 Series Active Tourer', '2 Series Gran Coupe', '3 Series', '3 Series Touring', '4 Series', '4 Series Gran Coupe', '4 Series Convertible',
    '5 Series', '5 Series Touring', '6 Series', '6 Series Gran Turismo', '7 Series', '8 Series', '8 Series Gran Coupe',
    'X1', 'X2', 'X3', 'X3 M', 'X4', 'X4 M', 'X5', 'X5 M', 'X6', 'X6 M', 'X7',
    'iX', 'iX1', 'iX2', 'iX3', 'i3', 'i4', 'i5', 'i5 Touring', 'i7',
    'Z3', 'Z4',
    'M2', 'M3', 'M3 Touring', 'M4', 'M4 Convertible', 'M5', 'M8',
    'M135i', 'M235i', 'M240i', 'M340i', 'M440i', 'M550i',
  ],
  'BYD': ['Atto 3', 'Seal', 'Dolphin', 'Tang', 'Han', 'Seal U', 'Dolphin Mini'],
  'Bugatti': ['Chiron', 'Chiron Sport', 'Veyron', 'Divo', 'Bolide', 'Tourbillon'],
  'Chevrolet': ['Camaro', 'Corvette', 'Cruze', 'Aveo', 'Captiva', 'Spark', 'Trax'],
  'Chrysler': ['300C', 'Grand Voyager', 'PT Cruiser', 'Crossfire'],
  'Citroën': [
    'C1', 'C2', 'C3', 'C3 Aircross', 'C4', 'C4 Cactus', 'C4 Picasso', 'C4 Spacetourer', 'C5', 'C5 Aircross', 'C5 X',
    'Berlingo', 'Grand C4 Picasso', 'Grand C4 Spacetourer', 'Dispatch',
    'ë-C3', 'ë-C4', 'ë-Berlingo', 'Ami',
    'C6', 'Saxo', 'Xsara', 'Xsara Picasso',
  ],
  'Cupra': ['Born', 'Formentor', 'Leon', 'Leon Sportstourer', 'Ateca', 'Terramar', 'Tavascan'],
  'Dacia': ['Sandero', 'Sandero Stepway', 'Logan', 'Logan MCV', 'Duster', 'Jogger', 'Spring', 'Bigster'],
  'DS': ['DS 3', 'DS 3 Crossback', 'DS 4', 'DS 4 Crossback', 'DS 7', 'DS 7 Crossback', 'DS 9'],
  'Ferrari': ['296 GTB', '296 GTS', '488 GTB', '488 Pista', '488 Spider', '812 Superfast', '812 GTS', 'F8 Tributo', 'F8 Spider', 'Roma', 'Roma Spider', 'Portofino', 'Portofino M', 'SF90 Stradale', 'SF90 Spider', 'Purosangue', 'California', 'California T', 'LaFerrari'],
  'Fiat': ['500', '500C', '500e', '500X', '500L', 'Panda', 'Tipo', 'Tipo Cross', 'Tipo Station Wagon', 'Doblo', 'Punto', 'Bravo', 'Stilo', '124 Spider', 'Qubo', 'Freemont'],
  'Ford': [
    'Fiesta', 'Fiesta ST', 'Focus', 'Focus ST', 'Focus RS', 'Mondeo', 'Mondeo Estate', 'Galaxy', 'S-Max', 'C-Max', 'Grand C-Max', 'B-Max', 'Ka', 'Ka+',
    'Kuga', 'Puma', 'Puma ST', 'EcoSport', 'Edge', 'Explorer', 'Bronco',
    'Mustang', 'Mustang Mach-E', 'Mustang Dark Horse',
    'Transit', 'Transit Custom', 'Transit Connect', 'Transit Courier', 'Tourneo', 'Tourneo Custom', 'Tourneo Connect', 'Tourneo Courier',
    'Ranger', 'Ranger Raptor', 'F-150',
    'Maverick',
  ],
  'GWM ORA': ['Good Cat', 'Lightning Cat', 'Funky Cat', 'Ballet Cat'],
  'Honda': [
    'Jazz', 'Jazz e:HEV', 'Civic', 'Civic Type R', 'Accord', 'HR-V', 'CR-V', 'CR-V e:PHEV', 'ZR-V', 'FR-V',
    'e', 'e:Ny1',
    'Legend', 'Insight', 'Pilot', 'NSX',
    'CR-Z', 'S2000', 'Integra',
  ],
  'Hyundai': [
    'i10', 'i20', 'i20 N', 'i30', 'i30 N', 'i30 Fastback', 'i30 Wagon', 'i40',
    'Tucson', 'Santa Fe', 'Santa Cruz', 'NEXO',
    'Kona', 'Kona Electric', 'Kona N', 'Bayon',
    'Ioniq', 'Ioniq 5', 'Ioniq 5 N', 'Ioniq 6',
    'Staria',
  ],
  'Infiniti': ['Q30', 'Q50', 'Q60', 'QX30', 'QX50', 'QX55', 'QX70', 'QX80'],
  'Jaecoo': ['J7', 'J8'],
  'Jaguar': [
    'XE', 'XF', 'XF Sportbrake', 'XJ',
    'E-Pace', 'F-Pace', 'F-Pace SVR', 'I-Pace',
    'F-Type', 'F-Type R',
    'S-Type', 'X-Type', 'X-Type Estate',
  ],
  'Jeep': ['Renegade', 'Compass', 'Cherokee', 'Grand Cherokee', 'Grand Cherokee 4xe', 'Wrangler', 'Wrangler 4xe', 'Avenger', 'Commander', 'Gladiator'],
  'Kia': [
    'Picanto', 'Rio', 'Ceed', 'Ceed GT', 'Pro Ceed', 'Ceed Sportswagon', 'Xceed',
    'Stonic', 'Niro', 'Niro EV', 'Niro PHEV', 'Sportage', 'Sportage PHEV', 'Sorento', 'Sorento PHEV', 'Telluride',
    'EV3', 'EV5', 'EV6', 'EV6 GT', 'EV9',
    'Soul', 'Soul EV',
    'Stinger', 'Carnival',
  ],
  'Lamborghini': ['Urus', 'Urus Performante', 'Urus S', 'Huracan', 'Huracan EVO', 'Huracan STO', 'Huracan Tecnica', 'Aventador', 'Revuelto'],
  'Land Rover': [
    'Defender 90', 'Defender 110', 'Defender 130',
    'Discovery', 'Discovery Sport',
    'Freelander', 'Freelander 2',
    'Range Rover', 'Range Rover P400e', 'Range Rover SV',
    'Range Rover Sport', 'Range Rover Sport SVR', 'Range Rover Sport PHEV',
    'Range Rover Evoque', 'Range Rover Evoque Convertible',
    'Range Rover Velar',
  ],
  'Leapmotor': ['C10', 'T03'],
  'Lexus': ['IS', 'IS 300h', 'ES', 'ES 300h', 'GS', 'LS', 'LS 500h', 'CT', 'CT 200h', 'UX', 'UX 250h', 'UX 300e', 'NX', 'NX 350h', 'NX 450h+', 'RX', 'RX 350h', 'RX 500h', 'LX', 'LC', 'LC 500', 'LC 500h', 'RC', 'RZ', 'LBX'],
  'Lynk & Co': ['01', '02', '03', '05'],
  'Maserati': ['Ghibli', 'Quattroporte', 'Levante', 'Levante Trofeo', 'GranTurismo', 'GranTurismo Folgore', 'Grecale', 'MC20'],
  'Mazda': ['2', '2 Hybrid', '3', '3 Fastback', '6', '6 Tourer', 'CX-3', 'CX-30', 'CX-5', 'CX-60', 'CX-80', 'MX-5', 'MX-5 RF', 'MX-30', 'RX-8'],
  'McLaren': ['540C', '570S', '570GT', '600LT', '720S', '720S Spider', '750S', '750S Spider', 'Artura', 'GT', 'P1', 'Senna', 'Speedtail'],
  'Mercedes-Benz': [
    'A-Class', 'A-Class Saloon', 'B-Class', 'C-Class', 'C-Class Estate', 'C-Class Cabriolet', 'E-Class', 'E-Class Estate', 'E-Class Cabriolet', 'S-Class', 'S-Class Cabriolet',
    'CLA', 'CLA Shooting Brake', 'CLS', 'CLS Shooting Brake',
    'GLA', 'GLB', 'GLC', 'GLC Coupe', 'GLE', 'GLE Coupe', 'GLS',
    'EQA', 'EQB', 'EQC', 'EQE', 'EQE SUV', 'EQS', 'EQS SUV',
    'AMG GT', 'AMG GT 4-Door', 'AMG A35', 'AMG A45', 'AMG A45 S', 'AMG C43', 'AMG C63', 'AMG C63 S', 'AMG E53', 'AMG E63', 'AMG E63 S',
    'G-Class', 'G 63 AMG',
    'SL', 'SLC', 'SLK',
    'V-Class', 'Vito', 'Sprinter', 'Marco Polo',
  ],
  'MG': ['3', 'ZS', 'ZS EV', 'HS', 'HS PHEV', '5', 'MG4', 'MG4 Trophy', 'Cyberster', 'ZT', 'TF', 'MG GT', 'Marvel R'],
  'MINI': [
    'Hatch', 'Hatch 3-Door', 'Hatch 5-Door', 'Convertible', 'Clubman', 'Countryman', 'Paceman', 'Coupe', 'Roadster',
    'Cooper', 'Cooper S', 'Cooper SE', 'John Cooper Works', 'John Cooper Works GP',
    'Cooper Countryman', 'Cooper S Countryman', 'John Cooper Works Countryman',
    'Aceman',
  ],
  'Mitsubishi': ['ASX', 'Eclipse Cross', 'Eclipse Cross PHEV', 'Outlander', 'Outlander PHEV', 'L200', 'Colt', 'Grandis', 'Galant', 'Carisma', 'Space Star'],
  'Morgan': ['Plus Six', 'Plus Four', 'Super 3', 'Midsummer'],
  'Nissan': [
    'Micra', 'Note', 'Note e-Power', 'Pulsar', 'Almera',
    'Juke', 'Juke Hybrid', 'Qashqai', 'Qashqai e-Power', 'X-Trail', 'X-Trail e-Power', 'Murano', 'Pathfinder', 'Navara',
    'Leaf', 'Ariya',
    '370Z', '370Z Nismo', '350Z',
    'GT-R',
  ],
  'Omoda': ['5', '5 EV', 'E5'],
  'Peugeot': [
    '108', '208', '208 GT', '308', '308 GT', '308 SW', '408', '408 GT', '508', '508 SW', '508 PSE',
    '2008', '3008', '3008 GT', '5008',
    'Rifter', 'Partner', 'Expert',
    'e-208', 'e-2008', 'e-308', 'e-3008', 'e-5008',
    '107', '207', '207 CC', '207 SW', '307', '307 SW', '407', '407 SW',
  ],
  'Porsche': [
    '911 Carrera', '911 Carrera S', '911 Carrera 4', '911 Carrera 4S', '911 Targa', '911 GT3', '911 GT3 RS', '911 Turbo', '911 Turbo S',
    '718 Boxster', '718 Boxster S', '718 Boxster GTS', '718 Cayman', '718 Cayman S', '718 Cayman GT4',
    'Cayenne', 'Cayenne S', 'Cayenne GTS', 'Cayenne Turbo', 'Cayenne E-Hybrid', 'Cayenne Coupé',
    'Macan', 'Macan S', 'Macan GTS', 'Macan Turbo', 'Macan Electric',
    'Panamera', 'Panamera 4', 'Panamera GTS', 'Panamera Turbo', 'Panamera Sport Turismo',
    'Taycan', 'Taycan 4S', 'Taycan GTS', 'Taycan Turbo', 'Taycan Turbo S', 'Taycan Cross Turismo', 'Taycan Sport Turismo',
  ],
  'Renault': [
    'Clio', 'Clio RS', 'Clio E-Tech', 'Megane', 'Megane RS', 'Megane E-Tech', 'Laguna', 'Laguna Estate', 'Talisman',
    'Captur', 'Captur E-Tech', 'Kadjar', 'Koleos', 'Arkana', 'Arkana E-Tech',
    'Scenic', 'Scenic E-Tech', 'Grand Scenic',
    'Austral', 'Austral E-Tech', 'Rafale',
    'Twingo', 'Twingo Electric',
    'Kangoo', 'Kangoo E-Tech', 'Trafic', 'Master',
    'Zoe',
  ],
  'Rolls-Royce': ['Ghost', 'Ghost Extended', 'Phantom', 'Phantom Extended', 'Wraith', 'Dawn', 'Cullinan', 'Cullinan Black Badge', 'Spectre'],
  'SEAT': ['Ibiza', 'Leon', 'Leon ST', 'Toledo', 'Alhambra', 'Arona', 'Ateca', 'Tarraco', 'Mii'],
  'Skoda': ['Fabia', 'Fabia Estate', 'Rapid', 'Rapid Spaceback', 'Octavia', 'Octavia Estate', 'Octavia RS', 'Superb', 'Superb Estate', 'Citigo', 'Citigo-e iV', 'Karoq', 'Kodiaq', 'Enyaq', 'Enyaq Coupe', 'Scala', 'Kamiq', 'Elroq'],
  'Smart': ['Forfour', 'Fortwo', 'Fortwo EQ', '#1', '#3'],
  'Subaru': ['Impreza', 'Impreza WRX', 'Legacy', 'Legacy Outback', 'Outback', 'Forester', 'XV', 'Crosstrek', 'BRZ', 'WRX', 'WRX STI', 'Solterra'],
  'Suzuki': ['Alto', 'Celerio', 'Swift', 'Swift Sport', 'Baleno', 'Ignis', 'S-Cross', 'S-Cross Hybrid', 'Vitara', 'Vitara Hybrid', 'Jimny', 'Grand Vitara', 'Across'],
  'Tesla': ['Model 3', 'Model 3 Performance', 'Model S', 'Model S Plaid', 'Model X', 'Model X Plaid', 'Model Y', 'Model Y Long Range', 'Model Y Performance', 'Cybertruck'],
  'Toyota': [
    'Aygo', 'Aygo X',
    'Yaris', 'Yaris Cross', 'Yaris GR Sport', 'GR Yaris',
    'Corolla', 'Corolla Touring Sports', 'Corolla GR Sport',
    'Camry', 'Camry Hybrid',
    'C-HR', 'C-HR Plug-in Hybrid',
    'RAV4', 'RAV4 Plug-in Hybrid', 'RAV4 Electric',
    'Land Cruiser', 'Land Cruiser Prado',
    'Hilux', 'Hilux Invincible', 'Hilux Active',
    'Proace', 'Proace Verso', 'Proace City',
    'GR86', 'GR Supra',
    'bZ4X',
    'Mirai',
    'Prius', 'Prius Plug-in',
    'Auris', 'Verso', 'Avensis',
    'Urban Cruiser',
  ],
  'Vauxhall': [
    'Corsa', 'Corsa-e', 'Corsa Electric', 'Corsa GS', 'Corsa SRi',
    'Astra', 'Astra Estate', 'Astra Sports Tourer', 'Astra Electric', 'Astra GS',
    'Insignia', 'Insignia Sports Tourer', 'Insignia Grand Sport', 'Vectra', 'Omega',
    'Mokka', 'Mokka-e', 'Mokka Electric', 'Grandland', 'Grandland Electric', 'Grandland X', 'Crossland', 'Crossland X',
    'Zafira', 'Zafira Tourer',
    'Meriva', 'Agila',
    'Cascada', 'Adam', 'Karl',
    'Vivaro', 'Vivaro-e', 'Movano',
  ],
  'Volkswagen': [
    'Polo', 'Polo GTI', 'Golf', 'Golf GTI', 'Golf GTE', 'Golf GTD', 'Golf R', 'Golf Estate', 'Golf Alltrack',
    'Jetta', 'Passat', 'Passat Estate', 'Passat Alltrack', 'Arteon', 'Arteon Shooting Brake', 'Phaeton',
    'T-Cross', 'T-Roc', 'T-Roc R', 'T-Roc Cabriolet', 'Taigo', 'Tiguan', 'Tiguan Allspace', 'Touareg', 'Amarok',
    'ID.3', 'ID.4', 'ID.5', 'ID.7', 'ID.7 Tourer',
    'Sharan', 'Touran',
    'Caddy', 'Caddy Maxi', 'Transporter', 'Caravelle', 'Multivan', 'Crafter',
    'up!', 'e-up!',
    'Beetle',
  ],
  'Volvo': [
    'V40', 'V40 Cross Country',
    'V60', 'V60 Cross Country', 'V60 Recharge',
    'V90', 'V90 Cross Country', 'V90 Recharge',
    'S40', 'S60', 'S60 Recharge', 'S90', 'S90 Recharge',
    'XC40', 'XC40 Recharge', 'XC40 P8',
    'XC60', 'XC60 Recharge',
    'XC90', 'XC90 Recharge',
    'C30', 'C70',
    'EX30', 'EX40', 'EX90',
    'EC40',
  ],
}

/**
 * Common trim/variant options per model.
 * Used to show a dropdown instead of free text when a match is found.
 * Key format: "Make|Model" (pipe-separated, lowercase-normalised at runtime).
 */
export const VARIANTS_BY_MODEL: Record<string, string[]> = {
  // ── Toyota ──────────────────────────────────────────────────────
  'Toyota|Aygo': ['1.0 VVT-i x', '1.0 VVT-i x-play', '1.0 VVT-i x-clusiv', '1.0 VVT-i x-trend'],
  'Toyota|Aygo X': ['1.0 VVT-i Pure', '1.0 VVT-i Edge', '1.0 VVT-i GR Sport', '1.0 VVT-i Limited Edition'],
  'Toyota|Yaris': ['1.0 VVT-i Icon', '1.5 Hybrid Icon', '1.5 Hybrid Design', '1.5 Hybrid Excel', '1.5 Hybrid GR Sport', 'GR Sport'],
  'Toyota|Yaris Cross': ['1.5 Hybrid Icon', '1.5 Hybrid Design', '1.5 Hybrid Excel', '1.5 Hybrid GR Sport', '1.5 Hybrid Adventure', 'AWD-i'],
  'Toyota|GR Yaris': ['1.6T GR Yaris', '1.6T GR Yaris Rally', '1.6T GR Yaris Rallye'],
  'Toyota|Corolla': ['1.2T Icon', '1.2T Design', '1.8 Hybrid Icon', '1.8 Hybrid Design', '1.8 Hybrid Excel', '2.0 Hybrid Excel', '2.0 Hybrid GR Sport', '1.8 Hybrid Touring Sports', '2.0 Hybrid Touring Sports GR Sport'],
  'Toyota|Corolla Touring Sports': ['1.8 Hybrid Icon', '1.8 Hybrid Design', '1.8 Hybrid Excel', '2.0 Hybrid Excel', '2.0 Hybrid GR Sport'],
  'Toyota|Camry': ['2.5 Hybrid Excel', '2.5 Hybrid Design', '2.5 Hybrid Icon'],
  'Toyota|C-HR': ['1.8 Hybrid Icon', '1.8 Hybrid Design', '1.8 Hybrid Excel', '2.0 Hybrid GR Sport', '2.0 Plug-in Hybrid Excel', '2.0 Plug-in Hybrid GR Sport'],
  'Toyota|RAV4': ['2.0 VVT-i Active', '2.0 Icon', '2.5 Hybrid Icon', '2.5 Hybrid Design', '2.5 Hybrid Excel', '2.5 Hybrid Dynamic Force', '2.5 Plug-in Hybrid Excel', '2.5 Plug-in Hybrid Dynamic Force', 'Adventure', 'GR Sport'],
  'Toyota|Land Cruiser': ['2.8D Active', '3.0D Active', '3.5 V6 Invincible', '3.5 V6 Invincible X', '2.8D GX', 'Executive'],
  'Toyota|Hilux': ['2.4D Active', '2.8D Active', '2.8D Icon', '2.8D Invincible', '2.8D Invincible X', 'Ranger', 'Rogue'],
  'Toyota|GR86': ['2.4 GR86', '2.4 GR86 Premium'],
  'Toyota|GR Supra': ['2.0T GR Supra', '3.0T GR Supra', '3.0T GR Supra Premium', '3.0T GR Supra A90 Edition'],
  'Toyota|Prius': ['1.8 VVT-h Active', '1.8 VVT-h Business Edition', '1.8 VVT-h Excel', '2.0 Plug-in Hybrid Excel', '2.0 Plug-in Hybrid GR Sport'],
  'Toyota|bZ4X': ['Pure', 'Pure Pro', 'Vision', 'Dynamic', 'Premium', '2WD', 'AWD'],

  // ── BMW ─────────────────────────────────────────────────────────
  'BMW|1 Series': ['116i SE', '116d SE', '118i Sport', '118i M Sport', '116d Sport', '118d Sport', '118d M Sport', 'M135i xDrive'],
  'BMW|3 Series': ['318i SE', '320i Sport', '320i M Sport', '320i xDrive', '330i M Sport', '330e M Sport', '318d SE', '320d Sport', '320d M Sport', '330d M Sport', 'M340i xDrive'],
  'BMW|3 Series Touring': ['318i SE', '320i Sport', '320i M Sport', '318d SE', '320d Sport', '320d M Sport', '330d M Sport', 'M340i xDrive'],
  'BMW|5 Series': ['520i SE', '520i Sport', '520i M Sport', '530i M Sport', '530e M Sport', '520d SE', '520d Sport', '520d M Sport', '530d M Sport', '540i xDrive', 'M550i xDrive'],
  'BMW|X3': ['xDrive20i SE', 'xDrive20i Sport', 'xDrive20i M Sport', 'xDrive30i M Sport', 'xDrive20d SE', 'xDrive20d Sport', 'xDrive20d M Sport', 'xDrive30d M Sport', 'xDrive30e M Sport'],
  'BMW|X5': ['xDrive40i SE', 'xDrive40i M Sport', 'xDrive30d SE', 'xDrive30d M Sport', 'xDrive40d M Sport', 'xDrive45e M Sport', 'M50i', 'M50d'],
  'BMW|4 Series': ['420i Sport', '420i M Sport', '430i M Sport', '420d Sport', '420d M Sport', '430d M Sport', 'M440i xDrive'],
  'BMW|M3': ['M3', 'M3 Competition', 'M3 Competition xDrive', 'M3 Touring Competition xDrive'],
  'BMW|M4': ['M4 Competition', 'M4 Competition xDrive', 'M4 Competition Convertible', 'M4 CSL'],
  'BMW|i4': ['eDrive35', 'eDrive40', 'xDrive40', 'M50'],
  'BMW|iX': ['xDrive40', 'xDrive50', 'M60'],

  // ── Mercedes-Benz ────────────────────────────────────────────────
  'Mercedes-Benz|A-Class': ['A 180 SE', 'A 180 Sport', 'A 180 AMG Line', 'A 200 AMG Line', 'A 220 AMG Line', 'A 180d SE', 'A 180d AMG Line', 'A 200d AMG Line', 'A 250 AMG Line'],
  'Mercedes-Benz|C-Class': ['C 180 SE', 'C 200 Sport', 'C 200 AMG Line', 'C 220d AMG Line', 'C 300 AMG Line', 'C 300e AMG Line', 'C 300de AMG Line', 'C 43 AMG'],
  'Mercedes-Benz|E-Class': ['E 200 SE', 'E 200 AMG Line', 'E 220d SE', 'E 220d AMG Line', 'E 300 AMG Line', 'E 300de AMG Line', 'E 400d AMG Line', 'E 53 AMG'],
  'Mercedes-Benz|GLC': ['GLC 200 AMG Line', 'GLC 220d AMG Line', 'GLC 300 AMG Line', 'GLC 300e AMG Line', 'GLC 300de AMG Line', 'GLC 43 AMG'],
  'Mercedes-Benz|GLE': ['GLE 300d AMG Line', 'GLE 350de AMG Line', 'GLE 400d AMG Line', 'GLE 450 AMG Line', 'GLE 53 AMG'],
  'Mercedes-Benz|S-Class': ['S 350d AMG Line', 'S 400d AMG Line', 'S 450 AMG Line', 'S 580 AMG Line', 'S 63 AMG', 'Maybach S 480', 'Maybach S 580', 'Maybach S 680'],

  // ── Audi ─────────────────────────────────────────────────────────
  'Audi|A3': ['1.0 TFSI Sport', '1.5 TFSI Sport', '1.5 TFSI S line', '2.0 TFSI S line', '30 TFSI Sport', '35 TFSI S line', '40 TFSI S line', '30 TDI Sport', '35 TDI S line', 'S3', 'RS3'],
  'Audi|A4': ['35 TFSI Sport', '35 TFSI S line', '40 TFSI S line', '40 TFSI Black Edition', '35 TDI Sport', '35 TDI S line', '40 TDI S line', '40 TDI Black Edition', 'S4', 'RS4'],
  'Audi|Q3': ['35 TFSI Sport', '35 TFSI S line', '45 TFSI quattro S line', '35 TDI Sport', '35 TDI S line', '45 TDI quattro S line'],
  'Audi|Q5': ['35 TFSI Sport', '40 TDI S line', '45 TFSI quattro S line', '50 TDI quattro S line', '55 TFSI e S line', 'SQ5'],
  'Audi|A6': ['40 TFSI Sport', '40 TDI S line', '45 TFSI S line', '45 TDI quattro S line', '55 TFSI S line', 'S6', 'RS6'],

  // ── Volkswagen ───────────────────────────────────────────────────
  'Volkswagen|Golf': ['1.0 TSI Life', '1.5 TSI Life', '1.5 TSI Style', '1.5 TSI R-Line', '2.0 TSI GTI', '2.0 TSI GTI Clubsport', '2.0 TSI R', '1.5 TDI Life', '1.5 TDI Style', '1.5 GTE', '1.4 GTE'],
  'Volkswagen|Polo': ['1.0 MPI Life', '1.0 TSI Life', '1.0 TSI Style', '1.0 TSI R-Line', '2.0 TSI GTI'],
  'Volkswagen|Tiguan': ['1.5 TSI Life', '2.0 TSI R-Line', '2.0 TSI 4Motion R-Line', '2.0 TDI Life', '2.0 TDI R-Line', '2.0 TDI 4Motion R-Line', 'R'],
  'Volkswagen|Passat': ['1.5 TSI SE', '1.5 TSI Business', '2.0 TDI SE Business', '2.0 TDI Business', '1.4 GTE'],
  'Volkswagen|ID.4': ['Pure', 'Pure Performance', 'Pro Performance', 'GTX', 'GTX 4MOTION'],
  'Volkswagen|ID.3': ['Pure Performance', 'Pro Performance', 'Pro S Performance', 'Tour'],

  // ── Ford ─────────────────────────────────────────────────────────
  'Ford|Fiesta': ['1.1 Ti-VCT Zetec', '1.0T EcoBoost Zetec', '1.0T EcoBoost ST-Line', '1.0T EcoBoost Titanium', '1.5T EcoBoost ST', '1.5T EcoBoost ST-2', '1.5 TDCi Zetec', '1.5 TDCi Titanium'],
  'Ford|Focus': ['1.0T EcoBoost Zetec', '1.0T EcoBoost ST-Line', '1.0T EcoBoost ST-Line X', '1.0T EcoBoost Titanium', '1.5T EcoBoost ST', '1.5 EcoBlue ST-Line', '1.5 EcoBlue Titanium', '2.3T EcoBoost ST', 'ST-3'],
  'Ford|Kuga': ['1.5T EcoBoost Zetec', '1.5T EcoBoost ST-Line', '1.5T EcoBoost Titanium', '2.5 Duratec FHEV ST-Line', '2.5 Duratec FHEV Titanium', '2.5 PHEV ST-Line', '2.5 PHEV Titanium'],
  'Ford|Mustang': ['2.3T EcoBoost Fastback', '5.0 V8 GT Fastback', '5.0 V8 GT Convertible', '5.0 V8 Dark Horse', 'Mach 1'],
  'Ford|Puma': ['1.0T EcoBoost Zetec', '1.0T EcoBoost ST-Line', '1.0T EcoBoost ST-Line X', '1.0T EcoBoost Titanium', '1.0T EcoBoost mHEV ST-Line', '1.5T EcoBoost ST'],

  // ── Vauxhall ─────────────────────────────────────────────────────
  'Vauxhall|Corsa': ['1.2 SE', '1.2 SE Premium', '1.2T SRi', '1.2T GS', '1.2T Ultimate', 'Electric SE', 'Electric GS', 'Electric Ultimate'],
  'Vauxhall|Astra': ['1.2T Design', '1.2T GS', '1.2T Ultimate', '1.5 Turbo D Design', '1.5 Turbo D GS', '1.6 Plug-in Hybrid GS', '1.6 Plug-in Hybrid Ultimate'],
  'Vauxhall|Mokka': ['1.2T SE', '1.2T GS', '1.2T Ultimate', 'Electric SE', 'Electric GS', 'Electric Ultimate'],
  'Vauxhall|Grandland': ['1.2T Design', '1.2T GS', '1.5 Turbo D GS', '1.6 Plug-in Hybrid GS', '1.6 Plug-in Hybrid Ultimate', 'Electric GS', 'Electric Ultimate'],

  // ── Nissan ───────────────────────────────────────────────────────
  'Nissan|Juke': ['1.0 DIG-T Visia', '1.0 DIG-T Acenta', '1.0 DIG-T N-Connecta', '1.0 DIG-T Tekna', '1.0 DIG-T N-Sport', '1.6 Hybrid N-Connecta', '1.6 Hybrid Tekna'],
  'Nissan|Qashqai': ['1.3 DIG-T Acenta', '1.3 DIG-T N-Connecta', '1.3 DIG-T Tekna', '1.3 DIG-T N-Sport', 'e-Power Acenta', 'e-Power N-Connecta', 'e-Power Tekna', 'e-Power Tekna+'],
  'Nissan|X-Trail': ['1.5 e-Power Acenta', '1.5 e-Power N-Connecta', '1.5 e-Power Tekna', '1.5 e-Power e-4orce N-Connecta', '1.5 e-Power e-4orce Tekna'],
  'Nissan|Leaf': ['Acenta', 'N-Connecta', 'Tekna', 'e+', 'e+ Tekna'],

  // ── Honda ─────────────────────────────────────────────────────────
  'Honda|Civic': ['1.0T VTEC Turbo SE', '1.0T VTEC Turbo SR', '1.5T VTEC Turbo Sport', '1.5 e:HEV Elegance', '1.5 e:HEV Advance', '1.5 e:HEV Sport', '2.0T Type R', '2.0T Type R GT'],
  'Honda|CR-V': ['1.5T VTEC SE', '1.5T VTEC Sport', '1.5T VTEC EX', '2.0 Hybrid SE', '2.0 Hybrid Sport', '2.0 Hybrid EX', '2.0 e:PHEV Advance', '2.0 e:PHEV Sport'],
  'Honda|Jazz': ['1.5 i-MMD Elegance', '1.5 i-MMD Advance', '1.5 i-MMD Sport', '1.5 i-MMD EX'],
  'Honda|HR-V': ['1.5 i-MMD Elegance', '1.5 i-MMD Advance', '1.5 i-MMD Advance Sport'],

  // ── Hyundai ──────────────────────────────────────────────────────
  'Hyundai|Tucson': ['1.6T GDi SE Connect', '1.6T GDi Premium', '1.6T GDi N Line', '1.6 CRDi SE Connect', '1.6 CRDi Premium', '1.6T Hybrid Premium', '1.6T Hybrid N Line', '1.6T PHEV Premium'],
  'Hyundai|i30': ['1.0T GDi SE Connect', '1.0T GDi Premium', '1.5T GDi N Line', '1.6 CRDi SE Connect', '1.6 CRDi Premium', '2.0T N Performance', '2.0T N Line S'],
  'Hyundai|Kona': ['1.0T GDi SE Connect', '1.0T GDi Premium', '1.6 CRDi SE Connect', 'Electric 39kWh SE', 'Electric 64kWh Premium', 'Electric 64kWh N Line', 'N'],
  'Hyundai|Ioniq 5': ['58kWh Standard Range', '73kWh RWD', '73kWh AWD', '77.4kWh RWD', '77.4kWh AWD', 'N'],
  'Hyundai|Santa Fe': ['1.6T PHEV SE Connect', '1.6T PHEV Premium', '2.2 CRDi SE Connect', '2.2 CRDi Premium'],

  // ── Kia ──────────────────────────────────────────────────────────
  'Kia|Sportage': ['1.0T GDi SE', '1.5T GDi SE Connect', '1.5T GDi GT-Line', '1.6 CRDi SE Connect', '1.6 CRDi GT-Line', '1.6T Hybrid GT-Line', '1.6T PHEV GT-Line S'],
  'Kia|EV6': ['58kWh Air', '77.4kWh Air', '77.4kWh GT-Line', '77.4kWh GT-Line S', '77.4kWh GT AWD'],
  'Kia|Ceed': ['1.0T GDi SE', '1.0T GDi SE Connect', '1.4T GDi GT-Line', '1.6 CRDi SE Connect', '1.6 CRDi GT-Line'],
  'Kia|Niro': ['1.6 GDi HEV SE', '1.6 GDi HEV GT-Line', '1.6 GDi PHEV SE', '1.6 GDi PHEV GT-Line', 'EV 64.8kWh SE', 'EV 64.8kWh GT-Line'],
  'Kia|Picanto': ['1.0 SE', '1.0 SE Connect', '1.0 GT-Line', '1.25 SE Connect', '1.25 GT-Line'],

  // ── Land Rover ───────────────────────────────────────────────────
  'Land Rover|Range Rover': ['2.0 P400e SE', '3.0 D300 SE', '3.0 D350 Autobiography', '4.4 P530 SV', 'SWB Autobiography', 'LWB Autobiography Extended'],
  'Land Rover|Range Rover Sport': ['2.0 P400e SE', '3.0 D300 SE', '3.0 D350 HSE', '3.0 D350 Autobiography', '4.4 P530 SVR', 'First Edition'],
  'Land Rover|Discovery': ['D250 SE', 'D300 SE', 'D300 HSE', 'D300 R-Dynamic HSE', 'D300 Autobiography', 'P360 Autobiography'],
  'Land Rover|Defender 90': ['2.0 P300 S', '2.0 P300 SE', '3.0 P400 HSE', '3.0 P400 X', '3.0 D300 HSE', 'Carpathian Edition'],
  'Land Rover|Defender 110': ['2.0 P300 S', '2.0 P300 SE', '3.0 P400 HSE', '3.0 P400 X', '3.0 D300 HSE', 'Carpathian Edition', 'First Edition'],

  // ── Porsche ───────────────────────────────────────────────────────
  'Porsche|Cayenne': ['3.0 V6 S', '2.9 Bi-Turbo S', '3.0 e-Hybrid', '4.0 V8 Turbo', '4.0 V8 Turbo S', '4.0 V8 Turbo S E-Hybrid'],
  'Porsche|Macan': ['2.0T', '3.0 S', '3.0 GTS', '2.9 Bi-Turbo Turbo', 'Electric', 'Electric S', 'Electric Turbo'],
  'Porsche|Taycan': ['RWD 79kWh', 'RWD 105kWh', '4S', 'GTS', 'Turbo', 'Turbo S'],

  // ── Skoda ─────────────────────────────────────────────────────────
  'Skoda|Octavia': ['1.0 TSI SE', '1.5 TSI SE L', '1.5 TSI DSG SE L', '2.0 TSI Sportline', '2.0 TDI SE L', '2.0 TDI DSG SE L', 'vRS', '1.4 TSI iV SE L'],
  'Skoda|Superb': ['1.5 TSI SE', '2.0 TDI SE L', '2.0 TDI DSG Sportline', '2.0 TDI DSG Laurin & Klement', '1.4 TSI iV SE'],
  'Skoda|Karoq': ['1.0 TSI SE', '1.5 TSI SE L', '1.5 TSI DSG SE L', '2.0 TDI SE L', '2.0 TDI 4x4 Sportline'],
  'Skoda|Kodiaq': ['1.5 TSI SE', '2.0 TDI SE L', '2.0 TDI 4x4 Sportline', '2.0 TDI 4x4 Laurin & Klement', 'RS'],
  'Skoda|Fabia': ['1.0 MPI SE', '1.0 TSI SE Comfort', '1.0 TSI Monte Carlo', '1.5 TSI DSG Monte Carlo'],

  // ── SEAT ──────────────────────────────────────────────────────────
  'SEAT|Ibiza': ['1.0 MPI SE', '1.0 TSI SE', '1.0 TSI FR', '1.0 TSI Xcellence', '1.5 TSI EVO FR Sport'],
  'SEAT|Leon': ['1.0 TSI SE', '1.5 TSI SE Dynamic', '1.5 TSI FR', '2.0 TSI Cupra', '1.5 TGI FR', '1.0 eTSI FR', 'e-Hybrid FR', 'e-Hybrid Xcellence'],
  'SEAT|Ateca': ['1.0 TSI SE', '1.5 TSI FR', '2.0 TDI SE', '2.0 TDI FR', '1.5 TSI EVO FR Sport'],

  // ── Renault ───────────────────────────────────────────────────────
  'Renault|Clio': ['1.0 TCe 65 Evolution', '1.0 TCe 90 Evolution', '1.0 TCe 90 Techno', '1.6 E-Tech 140 Evolution', '1.6 E-Tech 140 Techno', '1.3 TCe 130 RS Line', '1.5 dCi 85 Evolution'],
  'Renault|Captur': ['1.0 TCe 90 Evolution', '1.3 TCe 130 Techno', '1.3 TCe 155 RS Line', '1.6 E-Tech 145 Evolution', '1.6 E-Tech 145 Techno', '1.6 E-Tech PHEV 160 RS Line'],
  'Renault|Megane': ['1.3 TCe 115 Iconic', '1.3 TCe 140 Iconic', '1.3 TCe 160 RS Line', '1.5 dCi 115 Iconic', '2.0T 300 RS Trophy'],
  'Renault|Austral': ['1.2 E-Tech 130 Evolution', '1.2 E-Tech 200 Techno', '1.2 E-Tech 200 RS Line'],
  'Renault|Zoe': ['R110 Play', 'R110 Iconic', 'R135 Iconic', 'R135 GT Line', 'R135 GT Line+'],

  // ── Tesla ─────────────────────────────────────────────────────────
  'Tesla|Model 3': ['Standard Range Plus', 'Long Range', 'Long Range AWD', 'Performance', 'Rear-Wheel Drive', 'Highland'],
  'Tesla|Model Y': ['Standard Range', 'Long Range', 'Long Range AWD', 'Performance', 'Rear-Wheel Drive'],
  'Tesla|Model S': ['Long Range', 'Long Range AWD', 'Plaid', 'Plaid+'],
  'Tesla|Model X': ['Long Range', 'Long Range AWD', 'Plaid'],

  // ── Lexus ─────────────────────────────────────────────────────────
  'Lexus|IS': ['300h Executive', '300h Advance', '300h F Sport', '300h Takumi', '300h Sport'],
  'Lexus|NX': ['350h E-Four Premium', '350h E-Four Takumi', '450h+ F Sport', '450h+ Takumi'],
  'Lexus|RX': ['350h E-Four Premium', '350h E-Four Takumi', '450h+ F Sport', '500h F Sport Performance'],
  'Lexus|UX': ['250h Premium', '250h F Sport', '250h Takumi', '300e Premium', '300e Takumi'],

  // ── Mazda ─────────────────────────────────────────────────────────
  'Mazda|CX-5': ['2.0 SKYACTIV-G SE-L', '2.0 SKYACTIV-G Sport Black', '2.0 SKYACTIV-G GT Sport', '2.2 SKYACTIV-D SE-L', '2.2 SKYACTIV-D Sport Black', '2.2 SKYACTIV-D GT Sport Tech'],
  'Mazda|CX-30': ['2.0 SKYACTIV-G Pure', '2.0 SKYACTIV-G SE-L', '2.0 SKYACTIV-G GT Sport', 'e-SKYACTIV X', 'e-SKYACTIV X GT Sport Tech'],
  'Mazda|3': ['2.0 SKYACTIV-G SE-L', '2.0 SKYACTIV-G Sport Black', '2.0 SKYACTIV-G GT Sport', 'e-SKYACTIV X', 'Fastback'],
  'Mazda|MX-5': ['1.5 SKYACTIV-G Sport Nav', '2.0 SKYACTIV-G Sport Nav', '2.0 SKYACTIV-G GT Sport Nav', '2.0 SKYACTIV-G Roadster', '2.0 RF Sport Nav'],

  // ── Subaru ─────────────────────────────────────────────────────────
  'Subaru|Outback': ['2.5i SE', '2.5i CVT SE Premium', '2.5i Executive', '2.5i Executive Premium'],
  'Subaru|Forester': ['2.0 e-Boxer SE Premium', '2.0 e-Boxer XE Premium', '2.0 e-Boxer X'],
  'Subaru|Impreza': ['2.0i SE', '2.0i Premium', '2.5 WRX STI'],
  'Subaru|WRX': ['WRX Sport CVT', 'WRX Premium', 'WRX tS'],

  // ── Mitsubishi ────────────────────────────────────────────────────
  'Mitsubishi|Outlander': ['2.4h PHEV Verve', '2.4h PHEV Dynamic', '2.4h PHEV Exceed', '2.0 GX3h', '2.0 GX4hs'],
  'Mitsubishi|Eclipse Cross': ['1.5T Juro', '1.5T Verve', '2.4h PHEV Dynamic', '2.4h PHEV Exceed'],
  'Mitsubishi|ASX': ['2.0 GX2h', '2.0 GX3h', '2.0 4WD Dynamic'],

  // ── Mini ──────────────────────────────────────────────────────────
  'MINI|Hatch': ['1.5 Cooper', '2.0 Cooper S', '2.0 John Cooper Works', '1.5 Cooper Classic', '2.0 Cooper S Exclusive', 'Electric Cooper SE'],
  'MINI|Countryman': ['1.5 Cooper', '2.0 Cooper S', '2.0 Cooper S ALL4', '1.5 Cooper E', '2.0 Cooper S E ALL4', '2.0 John Cooper Works'],
  'MINI|Convertible': ['1.5 Cooper', '2.0 Cooper S', '2.0 John Cooper Works'],

  // ── Dacia ─────────────────────────────────────────────────────────
  'Dacia|Sandero': ['1.0 TCe 90 Essential', '1.0 TCe 90 Comfort', '1.0 TCe 110 Extreme', '1.0 TCe 110 Bi-Fuel'],
  'Dacia|Duster': ['1.0 TCe 90 Essential', '1.5 Blue dCi 115 SE Twenty', '1.3 TCe 130 SE Twenty', '1.3 TCe 130 Journey', 'Extreme'],
  'Dacia|Jogger': ['1.0 TCe 110 Essential', '1.0 TCe 110 Comfort', '1.0 TCe 110 Extreme', '1.6 Hybrid 140'],

  // ── Cupra ─────────────────────────────────────────────────────────
  'Cupra|Formentor': ['1.5 TSI 150', '2.0 TSI 190', '2.0 TSI 245', '2.0 TSI 310 4Drive', 'e-Hybrid 204', 'e-Hybrid 245'],
  'Cupra|Born': ['58kWh', '77kWh', '82kWh Performance', 'e-Boost'],
  'Cupra|Leon': ['1.5 TSI 150', '2.0 TSI 245', '2.0 TSI 300', 'e-Hybrid 204', 'e-Hybrid 245'],

  // ── Peugeot ───────────────────────────────────────────────────────
  'Peugeot|208': ['1.2 PureTech 75 Like', '1.2 PureTech 100 Allure', '1.2 PureTech 130 GT', 'e-208 Like', 'e-208 Allure', 'e-208 GT'],
  'Peugeot|2008': ['1.2 PureTech 100 Active', '1.2 PureTech 130 Allure', '1.2 PureTech 155 GT', 'e-2008 Active', 'e-2008 Allure', 'e-2008 GT'],
  'Peugeot|3008': ['1.2 PureTech 130 Active', '1.6 Hybrid 225 GT', '1.6 Hybrid 300 GT 4x4', 'e-3008 Long Range', 'e-3008 GT Premium'],
  'Peugeot|308': ['1.2 PureTech 110 Active', '1.2 PureTech 130 Allure', '1.5 BlueHDi 130 Allure', '1.6 Hybrid 180 GT', 'e-308 GT'],

  // ── Citroën ───────────────────────────────────────────────────────
  'Citroën|C3': ['PureTech 82 Feel', 'PureTech 110 Flair', 'ë-C3 You!', 'ë-C3 Plus'],
  'Citroën|C3 Aircross': ['PureTech 110 Feel', 'PureTech 130 Flair', 'Shine'],
  'Citroën|C5 Aircross': ['PureTech 130 Feel', 'BlueHDi 130 Flair+', 'Hybrid 225 Shine', 'Plug-in Hybrid 225 Shine'],

  // ── Volvo ─────────────────────────────────────────────────────────
  'Volvo|XC60': ['B4 Momentum', 'B4 R-Design', 'B4 Inscription', 'B5 R-Design', 'T6 AWD R-Design', 'T8 AWD Recharge', 'T8 AWD Ultimate Dark'],
  'Volvo|XC90': ['B5 Momentum', 'B5 R-Design', 'B5 Inscription', 'T8 AWD Recharge', 'T8 AWD Ultimate Dark'],
  'Volvo|V60': ['B3 Momentum', 'B4 R-Design', 'B4 Inscription', 'T8 AWD Recharge', 'Cross Country'],
  'Volvo|EX30': ['Single Motor Extended Range', 'Twin Motor Performance', 'Single Motor Core', 'Single Motor Plus'],

  // ── Alfa Romeo ────────────────────────────────────────────────────
  'Alfa Romeo|Giulia': ['2.0T 200 Sprint', '2.0T 280 Veloce', '2.0T 280 Super', '2.9 V6 Bi-Turbo Quadrifoglio'],
  'Alfa Romeo|Stelvio': ['2.0T 200 Sprint', '2.0T 280 Veloce', '2.0T 280 Super', '2.9 V6 Bi-Turbo Quadrifoglio'],
  'Alfa Romeo|Tonale': ['1.5T MHEV Sprint', '1.3 PHEV Sprint', '1.5T MHEV Veloce', '1.3 PHEV Veloce'],

  // ── Jaguar ────────────────────────────────────────────────────────
  'Jaguar|F-Type': ['2.0T R-Dynamic', '3.0 S/C V6 R-Dynamic', '5.0 V8 R', '5.0 V8 R AWD', '5.0 V8 SVR'],
  'Jaguar|F-Pace': ['2.0 P250 R-Dynamic SE', '2.0 D200 R-Dynamic SE', '3.0 P400 HSE', '5.0 V8 SVR'],
  'Jaguar|I-Pace': ['EV400 SE', 'EV400 HSE', 'EV400 SE Black', 'EV400 HSE Black'],

  // ── MG ────────────────────────────────────────────────────────────
  'MG|MG4': ['Standard', 'SE', 'SE Long Range', 'Trophy', 'Trophy Long Range', 'Trophy Extended Range EV'],
  'MG|ZS': ['1.5 VTi-TECH Explore', '1.5 VTi-TECH Exclusive', '1.0T GDi Exclusive'],
  'MG|ZS EV': ['Long Range SE', 'Long Range Trophy', 'Standard SE'],
  'MG|HS': ['1.5T Explore', '1.5T Exclusive', '1.5T Trophy'],
}

/** Returns models for a given make, case-insensitive. Returns [] if make not found. */
export function getModelsForMake(make: string): string[] {
  if (!make?.trim()) return []
  const key = Object.keys(MODELS_BY_MAKE).find(
    k => k.toLowerCase() === make.trim().toLowerCase()
  )
  return key ? MODELS_BY_MAKE[key] : []
}

/** Returns known variants for a given make + model combination. Returns [] if not found. */
export function getVariantsForModel(make: string, model: string): string[] {
  if (!make?.trim() || !model?.trim()) return []
  const makeNorm = make.trim()
  const modelNorm = model.trim()
  const key = Object.keys(VARIANTS_BY_MODEL).find(k => {
    const [km, kmod] = k.split('|')
    return km.toLowerCase() === makeNorm.toLowerCase() && kmod.toLowerCase() === modelNorm.toLowerCase()
  })
  return key ? VARIANTS_BY_MODEL[key] : []
}
