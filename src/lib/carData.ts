/**
 * Comprehensive UK car make/model/variant database.
 * Models and trims are the most common variants sold in the UK market.
 */
export const CAR_MAKES: string[] = [
  'Abarth', 'AC', 'AION', 'Aixam', 'AK', 'Alfa Romeo', 'Allard', 'Alpina', 'Alpine', 'Alvis', 'Ariel',
  'Armstrong Siddeley', 'Asia', 'Aston Martin', 'Audi', 'Austin', 'Austin-Healey', 'BAC', 'Beauford', 'Bentley',
  'BMW', 'Bond', 'Bowler', 'Brabus', 'Bristol', 'Bugatti', 'BYD', 'Cadillac', 'Carbodies', 'Caterham', 'CFMOTO',
  'Changan', 'Chery', 'Chesil', 'Chevrolet', 'Chrysler', 'Citroën', 'Coleman Milne', 'Corbin', 'Corvette', 'Cupra',
  'Dacia', 'Daewoo', 'DAF', 'Daihatsu', 'Daimler', 'Datsun', 'Dax', 'Deepal', 'DeLorean', 'Dodge', 'DS', 'Dutton',
  'Elemental', 'Ferrari', 'Fiat', 'Fisker', 'Ford', 'FSO', 'Gardner Douglas', 'Geely', 'Genesis', 'Gilbern',
  'Ginetta', 'GMC', 'Great Wall', 'GWM', 'GWM ORA', 'Hillman', 'Holden', 'Honda', 'Hongqi', 'Humber', 'Hummer',
  'Hyundai', 'Ineos', 'Infiniti', 'Invicta', 'Isuzu', 'Iveco', 'Jaecoo', 'Jaguar', 'JBA', 'Jeep', 'Jensen', 'Jowett',
  'KGM', 'Kia', 'Koenigsegg', 'KTM', 'Lada', 'Lagonda', 'Lamborghini', 'Lancia', 'Land Rover', 'LDV', 'Leapmotor',
  'Lepas', 'LEVC', 'Lexus', 'Leyland', 'Ligier', 'Lincoln', 'Lister', 'London Taxis International', 'Lotus', 'Lucid',
  'Lynk & Co', 'Mahindra', 'Marcos', 'Marlin', 'Maserati', 'Maxus', 'Maybach', 'Mazda', 'McLaren', 'Mercedes-Benz',
  'Messerschmitt', 'MG', 'Micro', 'Microcar', 'MINI', 'Mitsubishi', 'Mitsuoka', 'MOKE', 'Morgan', 'Morris', 'NG',
  'Nio', 'Nissan', 'Noble', 'Oldsmobile', 'Omoda', 'Opel', 'Pagani', 'Panther', 'Perodua', 'Peugeot', 'Pilgrim',
  'Plymouth', 'Polestar', 'Pontiac', 'Porsche', 'Proton', 'Quantum', 'Radical', 'Ram', 'Reliant', 'Renault', 'Reva',
  'Riley', 'Rimac', 'Rivian', 'Rolls-Royce', 'Rover', 'RUF', 'Saab', 'Scion', 'SEAT', 'Seres', 'Shelby', 'Singer',
  'Skoda', 'Skywell', 'Smart', 'Spyker', 'SsangYong', 'Standard', 'Subaru', 'Sunbeam', 'Suzuki', 'Talbot', 'Tata',
  'Tesla', 'Toyota', 'Trabant', 'Triumph', 'TVR', 'Ultima', 'Vanden Plas', 'Vauxhall', 'VinFast', 'Volkswagen',
  'Volvo', 'VRS', 'Westfield', 'Wiesmann', 'Wolseley', 'Xpeng', 'Yugo', 'Zastava', 'Zeekr', 'Zenos',
]
// Keep the selector alphabetic even when adding specialist makes.
CAR_MAKES.sort((a, b) => a.localeCompare(b, 'en-GB'))

/** Models per make, alphabetical. Includes current and discontinued UK-market models. */
export const MODELS_BY_MAKE: Record<string, string[]> = {
  'Abarth': ['124 Spider', '500', '500e', '595', '600e', '695', 'Grande Punto', 'Punto Evo'],
  'Alfa Romeo': [
    '4C', '8C Competizione', '33', '75', '145', '146', '147', '155', '156', '159', '164', '166', 'Alfasud', 'Alfetta',
    'Brera', 'Giulia', 'Giulietta', 'GT', 'GTV', 'Junior', 'MiTo', 'Montreal', 'Spider', 'Stelvio', 'Tonale',
  ],
  'Alpine': ['A110', 'A290', 'A310', 'A390', 'A610'],
  'Aston Martin': [
    'Cygnet', 'DB4', 'DB5', 'DB6', 'DB7', 'DB9', 'DB11', 'DB12', 'DBS', 'DBX', 'DBX707', 'Rapide', 'V8',
    'V12 Vantage', 'Valkyrie', 'Vanquish', 'Vantage', 'Virage',
  ],
  'Audi': [
    '80', '90', '100', 'A1', 'A1 Sportback', 'A2', 'A3', 'A3 Cabriolet', 'A3 Saloon', 'A3 Sportback', 'A4',
    'A4 Allroad', 'A4 Avant', 'A4 Cabriolet', 'A5', 'A5 Avant', 'A5 Cabriolet', 'A5 Sportback', 'A6', 'A6 Allroad',
    'A6 Avant', 'A6 e-tron', 'A7', 'A8', 'Cabriolet', 'Coupe', 'e-tron', 'e-tron GT', 'e-tron Sportback', 'Q2', 'Q3',
    'Q3 Sportback', 'Q4 e-tron', 'Q4 Sportback e-tron', 'Q5', 'Q5 Sportback', 'Q6 e-tron', 'Q6 Sportback e-tron',
    'Q7', 'Q8', 'Q8 e-tron', 'Quattro', 'R8', 'RS Q3', 'RS Q8', 'RS3', 'RS4', 'RS4 Avant', 'RS5', 'RS5 Sportback',
    'RS6', 'RS6 Avant', 'RS7', 'S1', 'S3', 'S4', 'S4 Avant', 'S5', 'S5 Sportback', 'S6', 'S6 Avant', 'S7', 'S8',
    'SQ2', 'SQ5', 'SQ7', 'SQ8', 'TT', 'TT Roadster', 'TT RS', 'TTS',
  ],
  'Bentley': [
    'Arnage', 'Azure', 'Bentayga', 'Bentayga EWB', 'Brooklands', 'Continental Flying Spur', 'Continental GT',
    'Continental GT Speed', 'Continental GTC', 'Continental R', 'Continental Supersports', 'Continental T', 'Eight',
    'Flying Spur', 'Mulsanne', 'Turbo R',
  ],
  'BMW': [
    '1 Series', '1 Series Convertible', '1 Series Coupe', '1 Series M Coupe', '2 Series', '2 Series Active Tourer',
    '2 Series Convertible', '2 Series Coupe', '2 Series Gran Coupe', '2 Series Gran Tourer', '3 Series',
    '3 Series Convertible', '3 Series Gran Turismo', '3 Series Touring', '4 Series', '4 Series Convertible',
    '4 Series Gran Coupe', '5 Series', '5 Series Gran Turismo', '5 Series Touring', '6 Series',
    '6 Series Convertible', '6 Series Gran Coupe', '6 Series Gran Turismo', '7 Series', '8 Series',
    '8 Series Convertible', '8 Series Gran Coupe', '2002', 'i3', 'i4', 'i5', 'i5 Touring', 'i7', 'i8', 'Isetta', 'iX',
    'iX1', 'iX2', 'iX3', 'M2', 'M3', 'M3 Touring', 'M4', 'M4 Convertible', 'M5', 'M5 Touring', 'M6', 'M8', 'M135i',
    'M235i', 'M240i', 'M340i', 'M440i', 'M550i', 'X1', 'X2', 'X3', 'X3 M', 'X4', 'X4 M', 'X5', 'X5 M', 'X6', 'X6 M',
    'X7', 'XM', 'Z1', 'Z3', 'Z4', 'Z8',
  ],
  'Bugatti': ['Bolide', 'Chiron', 'Chiron Sport', 'Divo', 'Tourbillon', 'Veyron'],
  'BYD': [
    'Atto 2', 'Atto 3', 'Dolphin', 'Dolphin Mini', 'Dolphin Surf', 'Han', 'Seal', 'Seal 6 DM-i Touring', 'Seal U',
    'Seal U DM-i', 'Sealion 7', 'Tang',
  ],
  'Caterham': ['21', '160', '170', '270', '310', '360', '420', '485', '620', 'CSR', 'Seven', 'Super Seven'],
  'Chevrolet': [
    'Aveo', 'Blazer', 'Camaro', 'Captiva', 'Corvette', 'Cruze', 'Epica', 'Kalos', 'Lacetti', 'Malibu', 'Matiz',
    'Orlando', 'Spark', 'Tacuma', 'Trax', 'Volt',
  ],
  'Chrysler': [
    '300C', 'Crossfire', 'Delta', 'Grand Voyager', 'Neon', 'PT Cruiser', 'Sebring', 'Viper', 'Voyager', 'Ypsilon',
  ],
  'Citroën': [
    '2CV', 'Ami', 'AX', 'Berlingo', 'Berlingo Multispace', 'BX', 'C-Crosser', 'C-Zero', 'C1', 'C2', 'C3',
    'C3 Aircross', 'C3 Picasso', 'C3 Pluriel', 'C4', 'C4 Cactus', 'C4 Coupe', 'C4 Picasso', 'C4 Spacetourer', 'C4 X',
    'C5', 'C5 Aircross', 'C5 Tourer', 'C5 X', 'C6', 'C8', 'CX', 'Dispatch', 'DS3', 'DS4', 'DS5', 'Dyane',
    'ë-Berlingo', 'ë-C3', 'ë-C4', 'Grand C4 Picasso', 'Grand C4 Spacetourer', 'GS', 'Nemo', 'Relay', 'Saxo', 'SM',
    'SpaceTourer', 'Synergie', 'Visa', 'Xantia', 'XM', 'Xsara', 'Xsara Picasso', 'ZX',
  ],
  'Cupra': ['Ateca', 'Born', 'Formentor', 'Leon', 'Leon Sportstourer', 'Tavascan', 'Terramar'],
  'Dacia': ['Bigster', 'Duster', 'Jogger', 'Logan', 'Logan MCV', 'Sandero', 'Sandero Stepway', 'Spring'],
  'Daihatsu': [
    'Applause', 'Charade', 'Copen', 'Cuore', 'Fourtrak', 'Grand Move', 'Hijet', 'Materia', 'Move', 'Sirion',
    'Sportrak', 'Terios', 'Trevis', 'YRV',
  ],
  'DS': ['DS 3', 'DS 3 Crossback', 'DS 4', 'DS 4 Crossback', 'DS 5', 'DS 7', 'DS 7 Crossback', 'DS 9', 'DS N°8'],
  'Ferrari': [
    '12Cilindri', '296 GTB', '296 GTS', '308', '328', '348', '360', '430', '458 Italia', '458 Spider', '488 GTB',
    '488 Pista', '488 Spider', '550 Maranello', '575M', '599 GTB', '612 Scaglietti', '812 GTS', '812 Superfast',
    'Amalfi', 'California', 'California T', 'Enzo', 'F8 Spider', 'F8 Tributo', 'F12berlinetta', 'F355', 'FF',
    'GTC4Lusso', 'LaFerrari', 'Mondial', 'Portofino', 'Portofino M', 'Purosangue', 'Roma', 'Roma Spider',
    'SF90 Spider', 'SF90 Stradale', 'Testarossa',
  ],
  'Fiat': [
    '124 Spider', '126', '127', '500', '500C', '500e', '500L', '500X', '600e', 'Barchetta', 'Brava', 'Bravo',
    'Cinquecento', 'Coupe', 'Croma', 'Doblo', 'Ducato', 'Fiorino', 'Freemont', 'Fullback', 'Grande Panda',
    'Grande Punto', 'Idea', 'Marea', 'Multipla', 'Panda', 'Panda 4x4', 'Punto', 'Punto Evo', 'Qubo', 'Regata',
    'Scudo', 'Sedici', 'Seicento', 'Stilo', 'Strada', 'Talento', 'Tempra', 'Tipo', 'Tipo Cross', 'Tipo Station Wagon',
    'Ulysse', 'Uno', 'X1/9',
  ],
  'Ford': [
    'Anglia', 'B-Max', 'Bronco', 'C-Max', 'Capri', 'Capri Electric', 'Consul', 'Corsair', 'Cortina', 'Cougar',
    'E-Tourneo Custom', 'E-Transit', 'E-Transit Custom', 'EcoSport', 'Edge', 'Escort', 'Escort RS Cosworth',
    'Explorer', 'Explorer Electric', 'F-150', 'Fiesta', 'Fiesta ST', 'Focus', 'Focus C-Max', 'Focus CC', 'Focus RS',
    'Focus ST', 'Fusion', 'Galaxy', 'Granada', 'Grand C-Max', 'GT', 'Ka', 'Ka+', 'Kuga', 'Maverick', 'Mondeo',
    'Mondeo Estate', 'Mustang', 'Mustang Dark Horse', 'Mustang Mach-E', 'Orion', 'Popular', 'Prefect', 'Probe',
    'Puma', 'Puma Gen-E', 'Puma ST', 'Ranger', 'Ranger Raptor', 'RS200', 'S-Max', 'Scorpio', 'Sierra', 'StreetKa',
    'Tourneo', 'Tourneo Connect', 'Tourneo Courier', 'Tourneo Custom', 'Transit', 'Transit Connect',
    'Transit Courier', 'Transit Custom', 'Zephyr', 'Zodiac',
  ],
  'Genesis': ['G70', 'G80', 'G90', 'GV60', 'GV70', 'GV80'],
  'GWM ORA': ['Ballet Cat', 'Funky Cat', 'Good Cat', 'Lightning Cat', 'ORA 03'],
  'Honda': [
    'Accord', 'Accord Tourer', 'Civic', 'Civic Tourer', 'Civic Type R', 'Concerto', 'CR-V', 'CR-V e:PHEV', 'CR-X',
    'CR-Z', 'Crosstour', 'e', 'e:Ny1', 'Element', 'FR-V', 'HR-V', 'Insight', 'Integra', 'Jazz', 'Jazz Crosstar',
    'Jazz e:HEV', 'Legend', 'Logo', 'NSX', 'Pilot', 'Prelude', 'S2000', 'Shuttle', 'Stream', 'ZR-V',
  ],
  'Hyundai': [
    'Accent', 'Amica', 'Atoz', 'Bayon', 'Coupe', 'Elantra', 'Genesis', 'Getz', 'i10', 'i20', 'i20 N', 'i30',
    'i30 Fastback', 'i30 N', 'i30 Wagon', 'i40', 'i800', 'Inster', 'Ioniq', 'Ioniq 5', 'Ioniq 5 N', 'Ioniq 6',
    'Ioniq 9', 'ix20', 'ix35', 'Kona', 'Kona Electric', 'Kona N', 'Lantra', 'Matrix', 'NEXO', 'Pony', 'S Coupe',
    'Santa Cruz', 'Santa Fe', 'Sonata', 'Staria', 'Stellar', 'Terracan', 'Trajet', 'Tucson', 'Veloster', 'XG',
  ],
  'Ineos': ['Grenadier', 'Quartermaster'],
  'Infiniti': ['Q30', 'Q50', 'Q60', 'QX30', 'QX50', 'QX55', 'QX70', 'QX80'],
  'Isuzu': ['D-Max', 'Piazza', 'Rodeo', 'Trooper'],
  'Jaecoo': ['7', '7 SHS', '8', 'J7', 'J8'],
  'Jaguar': [
    'E-Pace', 'E-Type', 'F-Pace', 'F-Pace SVR', 'F-Type', 'F-Type R', 'I-Pace', 'Mk2', 'S-Type', 'Sovereign',
    'X-Type', 'X-Type Estate', 'XE', 'XF', 'XF Sportbrake', 'XJ', 'XJ6', 'XJ8', 'XJ12', 'XJ220', 'XJR', 'XJS', 'XK',
    'XK8', 'XK120', 'XK140', 'XK150', 'XKR',
  ],
  'Jeep': [
    'Avenger', 'Cherokee', 'Commander', 'Compass', 'Gladiator', 'Grand Cherokee', 'Grand Cherokee 4xe', 'Patriot',
    'Renegade', 'Renegade 4xe', 'Wrangler', 'Wrangler 4xe',
  ],
  'Kia': [
    'Carens', 'Carnival', 'Ceed', 'Ceed GT', 'Ceed Sportswagon', 'Clarus', 'EV3', 'EV4', 'EV5', 'EV6', 'EV6 GT',
    'EV9', 'Magentis', 'Mentor', 'Niro', 'Niro EV', 'Niro PHEV', 'Optima', 'Picanto', 'Pride', 'Pro Ceed', 'ProCeed',
    'Rio', 'Sedona', 'Sephia', 'Shuma', 'Sorento', 'Sorento PHEV', 'Soul', 'Soul EV', 'Sportage', 'Sportage PHEV',
    'Stinger', 'Stonic', 'Telluride', 'Venga', 'Xceed',
  ],
  'Lamborghini': [
    'Aventador', 'Countach', 'Diablo', 'Gallardo', 'Huracan', 'Huracan EVO', 'Huracan STO', 'Huracan Tecnica',
    'Murcielago', 'Revuelto', 'Temerario', 'Urus', 'Urus Performante', 'Urus S',
  ],
  'Land Rover': [
    'Defender', 'Defender 90', 'Defender 110', 'Defender 130', 'Discovery', 'Discovery 3', 'Discovery 4',
    'Discovery Sport', 'Freelander', 'Freelander 2', 'Range Rover', 'Range Rover Classic', 'Range Rover Evoque',
    'Range Rover Evoque Convertible', 'Range Rover P400e', 'Range Rover Sport', 'Range Rover Sport PHEV',
    'Range Rover Sport SVR', 'Range Rover SV', 'Range Rover Velar', 'Series I', 'Series II', 'Series IIA',
    'Series III',
  ],
  'Leapmotor': ['B10', 'C10', 'T03'],
  'Lexus': [
    'CT', 'CT 200h', 'ES', 'ES 300h', 'GS', 'IS', 'IS 300h', 'IS F', 'LBX', 'LC', 'LC 500', 'LC 500h', 'LFA', 'LM',
    'LS', 'LS 500h', 'LX', 'NX', 'NX 350h', 'NX 450h+', 'RC', 'RC F', 'RX', 'RX 350h', 'RX 500h', 'RZ', 'SC', 'UX',
    'UX 250h', 'UX 300e',
  ],
  'Lotus': [
    '2-Eleven', '340R', 'Eclat', 'Elan', 'Eletre', 'Elise', 'Elite', 'Emeya', 'Emira', 'Esprit', 'Europa', 'Evija',
    'Evora', 'Excel', 'Exige', 'Seven',
  ],
  'Lynk & Co': ['01', '02', '03', '05'],
  'Mahindra': ['Bolero', 'Scorpio', 'Thar', 'XUV700'],
  'Maserati': [
    '3200 GT', '4200 GT', 'Biturbo', 'Coupe', 'Ghibli', 'GranCabrio', 'GranSport', 'GranTurismo',
    'GranTurismo Folgore', 'Grecale', 'Levante', 'Levante Trofeo', 'MC20', 'Quattroporte', 'Spyder',
  ],
  'Maybach': ['GLS', 'S-Class'],
  'Mazda': [
    '2', '2 Hybrid', '3', '3 Fastback', '5', '6', '6 Tourer', '6e', '121', '323', '626', 'B2500', 'Bongo', 'BT-50',
    'CX-3', 'CX-5', 'CX-7', 'CX-9', 'CX-30', 'CX-60', 'CX-80', 'Demio', 'MX-3', 'MX-5', 'MX-5 RF', 'MX-6', 'MX-30',
    'Premacy', 'RX-7', 'RX-8', 'Tribute', 'Xedos 6', 'Xedos 9',
  ],
  'McLaren': [
    '12C', '540C', '570GT', '570S', '600LT', '650S', '675LT', '720S', '720S Spider', '750S', '750S Spider', '765LT',
    'Artura', 'Elva', 'F1', 'GT', 'GTS', 'P1', 'Senna', 'Speedtail',
  ],
  'Mercedes-Benz': [
    '190', 'A-Class', 'A-Class Saloon', 'AMG A35', 'AMG A45', 'AMG A45 S', 'AMG C43', 'AMG C63', 'AMG C63 S',
    'AMG E53', 'AMG E63', 'AMG E63 S', 'AMG GT', 'AMG GT 4-Door', 'B-Class', 'C-Class', 'C-Class Cabriolet',
    'C-Class Coupe', 'C-Class Estate', 'Citan', 'CL', 'CLA', 'CLA Shooting Brake', 'CLC', 'CLE', 'CLE Cabriolet',
    'CLK', 'CLS', 'CLS Shooting Brake', 'E-Class', 'E-Class Cabriolet', 'E-Class Coupe', 'E-Class Estate', 'EQA',
    'EQB', 'EQC', 'EQE', 'EQE SUV', 'EQS', 'EQS SUV', 'EQT', 'EQV', 'eSprinter', 'eVito', 'G 63 AMG', 'G 500',
    'G-Class', 'GL-Class', 'GLA', 'GLB', 'GLC', 'GLC Coupe', 'GLE', 'GLE Coupe', 'GLS', 'M-Class', 'Marco Polo',
    'R-Class', 'S-Class', 'S-Class Cabriolet', 'S-Class Coupe', 'SL', 'SLC', 'SLK', 'SLR McLaren', 'SLS AMG',
    'Sprinter', 'T-Class', 'V-Class', 'Vaneo', 'Viano', 'Vito', 'X-Class',
  ],
  'MG': [
    '3', '5', '1100', 'Cyberster', 'Extender', 'HS', 'HS PHEV', 'IM5', 'IM6', 'Maestro', 'Magnette', 'Marvel R',
    'Metro', 'MG GT', 'MG S5 EV', 'MG4', 'MG4 Trophy', 'MG4 XPower', 'MG5 EV', 'MG6', 'MGA', 'MGB', 'MGB GT', 'MGC',
    'MGF', 'MGS5 EV', 'Midget', 'Montego', 'RV8', 'SV', 'TC', 'TD', 'TF', 'ZR', 'ZS', 'ZS EV', 'ZS Hybrid+', 'ZT',
    'ZT-T',
  ],
  'MINI': [
    'Aceman', 'Clubman', 'Clubvan', 'Convertible', 'Cooper', 'Cooper Countryman', 'Cooper S', 'Cooper S Countryman',
    'Cooper SE', 'Countryman', 'Coupe', 'Hatch', 'Hatch 3-Door', 'Hatch 5-Door', 'John Cooper Works',
    'John Cooper Works Countryman', 'John Cooper Works GP', 'Paceman', 'Roadster',
  ],
  'Mitsubishi': [
    '3000GT', 'ASX', 'Carisma', 'Colt', 'Delica', 'Eclipse Cross', 'Eclipse Cross PHEV', 'FTO', 'Galant', 'Grandis',
    'i-MiEV', 'L200', 'Lancer', 'Lancer Evolution', 'Mirage', 'Outlander', 'Outlander PHEV', 'Shogun', 'Shogun Pinin',
    'Shogun Sport', 'Sigma', 'Space Runner', 'Space Star', 'Space Wagon', 'Starion',
  ],
  'Morgan': [
    '3 Wheeler', '4/4', 'Aero 8', 'Aero SuperSports', 'Midsummer', 'Plus 8', 'Plus Four', 'Plus Six', 'Roadster',
    'Super 3', 'Supersport',
  ],
  'Nissan': [
    '100NX', '200SX', '300ZX', '350Z', '370Z', '370Z Nismo', 'Almera', 'Almera Tino', 'Ariya', 'Bluebird', 'Cube',
    'e-NV200', 'Elgrand', 'Evalia', 'Figaro', 'GT-R', 'Interstar', 'Juke', 'Juke Hybrid', 'Kubistar', 'Leaf',
    'Maxima', 'Maxima QX', 'Micra', 'Micra C+C', 'Murano', 'Navara', 'Note', 'Note e-Power', 'NV200', 'NV300',
    'NV400', 'Pathfinder', 'Patrol', 'Pixo', 'Prairie', 'Primastar', 'Primera', 'Pulsar', 'Qashqai',
    'Qashqai e-Power', 'Qashqai+2', 'Serena', 'Skyline', 'Sunny', 'Terrano', 'Terrano II', 'Tiida', 'Townstar',
    'X-Trail', 'X-Trail e-Power',
  ],
  'Omoda': ['5', '5 EV', '9', '9 SHS', 'E5'],
  'Peugeot': [
    '106', '107', '108', '205', '206', '206 CC', '206 SW', '207', '207 CC', '207 SW', '208', '208 GT', '305', '306',
    '307', '307 SW', '308', '308 CC', '308 GT', '308 SW', '309', '405', '406', '406 Coupe', '407', '407 SW', '408',
    '408 GT', '505', '508', '508 PSE', '508 SW', '605', '607', '806', '807', '1007', '2008', '3008', '3008 GT',
    '4007', '4008', '5008', 'Bipper', 'Boxer', 'e-208', 'e-308', 'e-2008', 'e-3008', 'e-5008', 'Expert',
    'Expert Tepee', 'iOn', 'Partner', 'Partner Tepee', 'RCZ', 'Rifter', 'Traveller',
  ],
  'Polestar': ['Polestar 1', 'Polestar 2', 'Polestar 3', 'Polestar 4', 'Polestar 5'],
  'Porsche': [
    '356', '718 Boxster', '718 Boxster GTS', '718 Boxster S', '718 Cayman', '718 Cayman GT4', '718 Cayman S',
    '718 Spyder', '911', '911 Carrera', '911 Carrera 4', '911 Carrera 4S', '911 Carrera GTS', '911 Carrera S',
    '911 Dakar', '911 GT2 RS', '911 GT3', '911 GT3 RS', '911 Targa', '911 Turbo', '911 Turbo S', '914', '918 Spyder',
    '924', '928', '944', '959', '968', 'Boxster', 'Carrera GT', 'Cayenne', 'Cayenne Coupé', 'Cayenne E-Hybrid',
    'Cayenne GTS', 'Cayenne S', 'Cayenne Turbo', 'Cayman', 'Macan', 'Macan Electric', 'Macan GTS', 'Macan S',
    'Macan Turbo', 'Panamera', 'Panamera 4', 'Panamera GTS', 'Panamera Sport Turismo', 'Panamera Turbo', 'Taycan',
    'Taycan 4S', 'Taycan Cross Turismo', 'Taycan GTS', 'Taycan Sport Turismo', 'Taycan Turbo', 'Taycan Turbo S',
  ],
  'Renault': [
    '4', '4 E-Tech', '5', '5 E-Tech', '19', '21', '25', 'Alaskan', 'Arkana', 'Arkana E-Tech', 'Austral',
    'Austral E-Tech', 'Avantime', 'Captur', 'Captur E-Tech', 'Clio', 'Clio E-Tech', 'Clio RS', 'Espace', 'Fluence',
    'Fuego', 'Grand Espace', 'Grand Modus', 'Grand Scenic', 'Kadjar', 'Kangoo', 'Kangoo E-Tech', 'Koleos', 'Laguna',
    'Laguna Coupe', 'Laguna Estate', 'Master', 'Megane', 'Megane E-Tech', 'Megane RS', 'Modus', 'Rafale', 'Safrane',
    'Scenic', 'Scenic E-Tech', 'Scenic RX4', 'Sport Spider', 'Symbioz', 'Talisman', 'Trafic', 'Twingo',
    'Twingo Electric', 'Twizy', 'Vel Satis', 'Wind', 'Zoe',
  ],
  'Rolls-Royce': [
    'Corniche', 'Cullinan', 'Cullinan Black Badge', 'Dawn', 'Ghost', 'Ghost Extended', 'Park Ward', 'Phantom',
    'Phantom Extended', 'Silver Cloud', 'Silver Seraph', 'Silver Shadow', 'Silver Spirit', 'Silver Spur', 'Spectre',
    'Wraith',
  ],
  'Rover': [
    '25', '45', '75', '100', '200', '214', '216', '220', '400', '414', '416', '420', '600', '620', '800', '820',
    '827', 'CityRover', 'Metro', 'Mini', 'P4', 'P5', 'P6', 'SD1', 'Streetwise',
  ],
  'Saab': ['9-3', '9-5', '90', '96', '99', '900', '9000'],
  'SEAT': [
    'Alhambra', 'Altea', 'Altea XL', 'Arona', 'Arosa', 'Ateca', 'Cordoba', 'Exeo', 'Ibiza', 'Ibiza ST', 'Leon',
    'Leon ST', 'Mii', 'Mii Electric', 'Tarraco', 'Toledo',
  ],
  'Skoda': [
    'Citigo', 'Citigo-e iV', 'Elroq', 'Enyaq', 'Enyaq Coupe', 'Estelle', 'Fabia', 'Fabia Estate', 'Favorit',
    'Felicia', 'Kamiq', 'Karoq', 'Kodiaq', 'Octavia', 'Octavia Estate', 'Octavia RS', 'Rapid', 'Rapid Spaceback',
    'Roomster', 'Scala', 'Superb', 'Superb Estate', 'Yeti',
  ],
  'Smart': ['#1', '#3', '#5', 'Crossblade', 'Forfour', 'Forfour EQ', 'Fortwo', 'Fortwo EQ', 'Roadster'],
  'SsangYong': ['Actyon', 'Korando', 'Kyron', 'Musso', 'Rexton', 'Rodius', 'Stavic', 'Tivoli', 'Torres', 'Turismo'],
  'Subaru': [
    'BRZ', 'Crosstrek', 'Forester', 'Impreza', 'Impreza WRX', 'Justy', 'Legacy', 'Legacy Outback', 'Levorg',
    'Outback', 'Solterra', 'SVX', 'Trezia', 'Tribeca', 'WRX', 'WRX STI', 'XV',
  ],
  'Suzuki': [
    'Across', 'Alto', 'Baleno', 'Cappuccino', 'Celerio', 'eVitara', 'Grand Vitara', 'Ignis', 'Jimny', 'Kizashi',
    'Liana', 'S-Cross', 'S-Cross Hybrid', 'Samurai', 'SJ', 'Splash', 'Swace', 'Swift', 'Swift Sport', 'SX4', 'Vitara',
    'Vitara Hybrid', 'Wagon R+', 'X-90',
  ],
  'Tesla': [
    'Cybertruck', 'Model 3', 'Model 3 Performance', 'Model S', 'Model S Plaid', 'Model X', 'Model X Plaid', 'Model Y',
    'Model Y Long Range', 'Model Y Performance', 'Roadster',
  ],
  'Toyota': [
    'Auris', 'Avensis', 'Avensis Tourer', 'Avensis Verso', 'Aygo', 'Aygo X', 'bZ4X', 'C-HR', 'C-HR Plug-in Hybrid',
    'Camry', 'Camry Hybrid', 'Carina', 'Carina E', 'Celica', 'Corolla', 'Corolla GR Sport', 'Corolla Touring Sports',
    'Corolla Verso', 'GR Supra', 'GR Yaris', 'GR86', 'GT86', 'Hiace', 'Hilux', 'Hilux Active', 'Hilux Invincible',
    'iQ', 'Land Cruiser', 'Land Cruiser Amazon', 'Land Cruiser Colorado', 'Land Cruiser Prado', 'Mirai', 'MR2',
    'Paseo', 'Picnic', 'Previa', 'Prius', 'Prius Plug-in', 'Prius+', 'Proace', 'Proace City', 'Proace City Verso',
    'Proace Verso', 'RAV4', 'RAV4 Electric', 'RAV4 Plug-in Hybrid', 'Starlet', 'Supra', 'Urban Cruiser', 'Verso',
    'Verso-S', 'Yaris', 'Yaris Cross', 'Yaris GR Sport', 'Yaris Verso',
  ],
  'TVR': ['Cerbera', 'Chimaera', 'Griffith', 'Sagaris', 'T350', 'Tamora', 'Tasmin', 'Tuscan', 'Vixen'],
  'Vauxhall': [
    'Adam', 'Agila', 'Ampera', 'Antara', 'Arena', 'Astra', 'Astra Convertible', 'Astra Coupe', 'Astra Electric',
    'Astra Estate', 'Astra GS', 'Astra GTC', 'Astra Sports Tourer', 'Astra TwinTop', 'Belmont', 'Brava', 'Calibra',
    'Carlton', 'Cascada', 'Cavalier', 'Chevette', 'Combo', 'Combo Life', 'Corsa', 'Corsa Electric', 'Corsa GS',
    'Corsa SRi', 'Corsa-e', 'Cresta', 'Crossland', 'Crossland X', 'Firenza', 'Frontera', 'Frontera Electric',
    'Grandland', 'Grandland Electric', 'Grandland X', 'Insignia', 'Insignia Country Tourer', 'Insignia Grand Sport',
    'Insignia Sports Tourer', 'Karl', 'Magnum', 'Meriva', 'Mokka', 'Mokka Electric', 'Mokka X', 'Mokka-e', 'Monaro',
    'Movano', 'Nova', 'Omega', 'Royale', 'Senator', 'Signum', 'Sintra', 'Tigra', 'Vectra', 'Victor', 'Viva', 'Vivaro',
    'Vivaro-e', 'VX220', 'VXR8', 'Zafira', 'Zafira Life', 'Zafira Tourer',
  ],
  'VinFast': ['VF 8', 'VF 9', 'VF e34'],
  'Volkswagen': [
    'Amarok', 'Arteon', 'Arteon Shooting Brake', 'Beetle', 'Beetle Cabriolet', 'Bora', 'Caddy', 'Caddy Life',
    'Caddy Maxi', 'California', 'Caravelle', 'CC', 'Corrado', 'Crafter', 'e-Golf', 'e-up!', 'Eos', 'Fox', 'Golf',
    'Golf Alltrack', 'Golf Cabriolet', 'Golf Estate', 'Golf GTD', 'Golf GTE', 'Golf GTI', 'Golf Plus', 'Golf R',
    'Golf SV', 'ID. Buzz', 'ID. Buzz Cargo', 'ID.3', 'ID.4', 'ID.5', 'ID.7', 'ID.7 Tourer', 'Jetta', 'Karmann Ghia',
    'Lupo', 'Multivan', 'Passat', 'Passat Alltrack', 'Passat Estate', 'Phaeton', 'Polo', 'Polo GTI', 'Scirocco',
    'Sharan', 'T-Cross', 'T-Roc', 'T-Roc Cabriolet', 'T-Roc R', 'Taigo', 'Tayron', 'Tiguan', 'Tiguan Allspace',
    'Touareg', 'Touran', 'Transporter', 'Type 2', 'up!', 'Vento',
  ],
  'Volvo': [
    '240', '340', '440', '460', '480', '740', '760', '850', '940', '960', 'Amazon', 'C30', 'C70', 'EC40', 'ES90',
    'EX30', 'EX30 Cross Country', 'EX40', 'EX90', 'P1800', 'S40', 'S60', 'S60 Recharge', 'S70', 'S80', 'S90',
    'S90 Recharge', 'V40', 'V40 Cross Country', 'V50', 'V60', 'V60 Cross Country', 'V60 Recharge', 'V70', 'V90',
    'V90 Cross Country', 'V90 Recharge', 'XC40', 'XC40 P8', 'XC40 Recharge', 'XC60', 'XC60 Recharge', 'XC70', 'XC90',
    'XC90 Recharge',
  ],
  'Xpeng': ['G6', 'G9', 'P7'],
  'Zeekr': ['001', '7X', '009', 'X'],
}

// Additional new, historic, specialist and imported makes/models from the UK market.
// They are catalogue choices only: never synthetic listings or claimed stock counts.
const EXTRA_MODELS_BY_MAKE: Record<string, string[]> = {
  'AC': ['Ace', 'Cobra', 'Cobra GT Roadster'],
  'AION': ['UT', 'V', 'Y Plus'],
  'Aixam': ['City', 'Coupe', 'Crossover', 'Minauto'],
  'AK': ['427'],
  'Allard': ['J2', 'J2X', 'K3'],
  'Alpina': ['B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B10', 'B12', 'D3', 'D4', 'D5', 'Roadster S', 'XB7', 'XD3', 'XD4'],
  'Alvis': ['TA 14', 'TC 21', 'TD 21', 'TE 21', 'TF 21'],
  'Ariel': ['Atom', 'Hipercar', 'Nomad'],
  'Armstrong Siddeley': ['Hurricane', 'Sapphire', 'Star Sapphire', 'Whitley'],
  'Asia': ['Rocsta'],
  'Austin': [
    '1100', '1300', '1800', 'A30', 'A35', 'A40', 'Allegro', 'Ambassador', 'Cambridge', 'Maestro', 'Maxi', 'Metro',
    'Mini', 'Montego', 'Princess', 'Seven', 'Westminster',
  ],
  'Austin-Healey': ['100', '100-6', '3000', 'Sprite'],
  'BAC': ['Mono', 'Mono R'],
  'Beauford': ['Tourer'],
  'Bond': ['Bug', 'Equipe', 'Minicar'],
  'Bowler': ['EXR', 'Wildcat'],
  'Brabus': ['700', '800', '900', 'Rocket 900', 'Rocket 1000'],
  'Bristol': ['401', '403', '411', 'Blenheim', 'Fighter'],
  'Cadillac': ['ATS', 'BLS', 'CT5', 'CTS', 'Escalade', 'Lyriq', 'Optiq', 'Seville', 'SRX', 'STS', 'XT4', 'XT5'],
  'Carbodies': ['FX4'],
  'CFMOTO': ['CForce', 'UForce', 'ZForce'],
  'Changan': ['Deepal S07'],
  'Chery': ['Omoda 5', 'Tiggo 4', 'Tiggo 7', 'Tiggo 8'],
  'Chesil': ['Speedster'],
  'Coleman Milne': ['Dorchester', 'Grosvenor'],
  'Corbin': ['Sparrow'],
  'Corvette': ['C5', 'C6', 'C7', 'C8', 'Stingray', 'Z06'],
  'Daewoo': ['Espero', 'Evanda', 'Kalos', 'Lacetti', 'Lanos', 'Leganza', 'Matiz', 'Nexia', 'Nubira', 'Tacuma'],
  'DAF': ['33', '44', '55', '66'],
  'Daimler': ['Double Six', 'Sovereign', 'Super Eight', 'V8', 'XJ6'],
  'Datsun': ['120Y', '240Z', '260Z', '280Z', '280ZX', 'Bluebird', 'Cherry'],
  'Dax': ['427', 'Rush'],
  'Deepal': ['S07'],
  'DeLorean': ['DMC-12'],
  'Dodge': ['Avenger', 'Caliber', 'Challenger', 'Charger', 'Journey', 'Nitro', 'Viper'],
  'Dutton': ['Phaeton', 'Sierra'],
  'Elemental': ['RP1'],
  'Fisker': ['Karma', 'Ocean'],
  'FSO': ['125p', 'Polonez'],
  'Gardner Douglas': ['GD T70', 'GD427'],
  'Geely': ['EX5', 'Starray'],
  'Gilbern': ['Genie', 'GT', 'Invader'],
  'Ginetta': ['G4', 'G12', 'G15', 'G21', 'G27', 'G33', 'G40', 'G55', 'G56'],
  'GMC': ['Canyon', 'Hummer EV', 'Sierra', 'Yukon'],
  'Great Wall': ['Poer', 'Steed'],
  'GWM': ['Haval H6', 'Haval Jolion', 'ORA 03', 'Wey 03', 'Wey 05'],
  'Hillman': ['Avenger', 'Hunter', 'Imp', 'Minx', 'Super Minx'],
  'Holden': ['Astra', 'Barina', 'Commodore', 'Monaro', 'Ute', 'Vectra'],
  'Hongqi': ['E-HS9'],
  'Humber': ['Hawk', 'Imperial', 'Sceptre', 'Super Snipe'],
  'Hummer': ['EV', 'H2', 'H3'],
  'Invicta': ['S Type', 'S1'],
  'Iveco': ['Daily', 'Eurocargo', 'S-Way'],
  'JBA': ['Falcon'],
  'Jensen': ['CV8', 'Healey', 'Interceptor'],
  'Jowett': ['Javelin', 'Jupiter'],
  'KGM': ['Actyon', 'Korando', 'Musso', 'Rexton', 'Tivoli', 'Torres', 'Torres EVX'],
  'Koenigsegg': ['Agera', 'CCX', 'Gemera', 'Jesko', 'Regera'],
  'KTM': ['X-Bow', 'X-Bow GT-XR'],
  'Lada': ['Niva', 'Riva', 'Samara'],
  'Lagonda': ['Rapide', 'Taraf'],
  'Lancia': ['Beta', 'Dedra', 'Delta', 'Fulvia', 'Prisma', 'Stratos', 'Thema', 'Y10', 'Ypsilon'],
  'LDV': ['Convoy', 'Cub', 'Maxus', 'Pilot'],
  'Lepas': ['L8'],
  'LEVC': ['TX', 'VN5'],
  'Leyland': ['Roadrunner', 'Sherpa'],
  'Ligier': ['JS50', 'Myli', 'X-Too'],
  'Lincoln': ['Aviator', 'Continental', 'Mark VIII', 'MKX', 'MKZ', 'Navigator', 'Town Car'],
  'Lister': ['Knobbly', 'Storm'],
  'London Taxis International': ['TX', 'TX1', 'TX2', 'TX4'],
  'Lucid': ['Air', 'Gravity'],
  'Marcos': ['GT', 'Mantara', 'Mantis', 'Mantula', 'Mini Marcos', 'TSO'],
  'Marlin': ['Berlinetta', 'Roadster', 'Sportster'],
  'Maxus': ['eDeliver 3', 'eDeliver 9', 'MIFA 9', 'T90 EV'],
  'Messerschmitt': ['KR200'],
  'Micro': ['Microlino'],
  'Microcar': ['Dué', 'M.Go', 'Virgo'],
  'Mitsuoka': ['Himiko', 'Orochi', 'Viewt'],
  'MOKE': ['Moke', 'Moke Electric'],
  'Morris': ['1300', 'Cowley', 'Isis', 'Ital', 'Marina', 'Mini', 'Minor', 'Oxford', 'Traveller'],
  'NG': ['TA', 'TC', 'TD', 'TF'],
  'Nio': ['EL6', 'EL8', 'ET5', 'ET7'],
  'Noble': ['M12', 'M400', 'M600'],
  'Oldsmobile': ['Cutlass', 'Toronado'],
  'Opel': [
    'Adam', 'Ampera', 'Ampera-e', 'Ascona', 'Astra', 'Calibra', 'Cascada', 'Combo', 'Commodore', 'Corsa', 'Crossland',
    'Frontera', 'Grandland', 'GT', 'Insignia', 'Kadett', 'Karl', 'Manta', 'Meriva', 'Mokka', 'Monza', 'Omega',
    'Rekord', 'Senator', 'Speedster', 'Tigra', 'Vectra', 'Zafira',
  ],
  'Pagani': ['Huayra', 'Utopia', 'Zonda'],
  'Panther': ['De Ville', 'J72', 'Kallista', 'Lima', 'Solo'],
  'Perodua': ['Kelisa', 'Myvi', 'Nippa'],
  'Pilgrim': ['Bulldog', 'Sumo'],
  'Plymouth': ['Barracuda', 'Fury', 'Prowler', 'Road Runner'],
  'Pontiac': ['Firebird', 'GTO', 'Trans Am'],
  'Proton': ['Gen-2', 'Persona', 'Satria', 'Savvy', 'Wira'],
  'Quantum': ['2+2', 'H4', 'Xtreme'],
  'Radical': ['Rapture', 'SR3', 'SR8'],
  'Ram': ['1500', '2500'],
  'Reliant': ['Fox', 'Kitten', 'Rebel', 'Regal', 'Rialto', 'Robin', 'Sabre', 'Scimitar'],
  'Reva': ['G-Wiz', 'i'],
  'Riley': ['4/68', '4/72', 'Elf', 'Kestrel', 'One-Point-Five', 'Pathfinder', 'RMA', 'RMB'],
  'Rimac': ['Concept One', 'Nevera'],
  'Rivian': ['R1S', 'R1T'],
  'RUF': ['CTR', 'RGT', 'SCR'],
  'Scion': ['FR-S', 'tC', 'xB'],
  'Seres': ['3', '5'],
  'Shelby': ['Cobra', 'GT350', 'GT500'],
  'Singer': ['Chamois', 'Classic Study', 'DLS', 'Gazelle', 'Hunter', 'Le Mans', 'Nine', 'Turbo Study', 'Vogue'],
  'Skywell': ['BE11'],
  'Spyker': ['C8'],
  'Standard': ['Atlas', 'Eight', 'Ensign', 'Pennant', 'Ten', 'Vanguard'],
  'Sunbeam': ['Alpine', 'Rapier', 'Stiletto', 'Tiger'],
  'Talbot': ['Alpine', 'Express', 'Horizon', 'Samba', 'Solara', 'Sunbeam'],
  'Tata': ['Indica', 'Nano', 'Safari', 'Vista'],
  'Trabant': ['1.1', '601'],
  'Triumph': [
    '2000', 'Acclaim', 'Dolomite', 'GT6', 'Herald', 'Spitfire', 'Stag', 'Toledo', 'TR2', 'TR3', 'TR4', 'TR5', 'TR6',
    'TR7', 'TR8', 'Vitesse',
  ],
  'Ultima': ['Can-Am', 'Evolution', 'GTR', 'RS', 'Sport', 'Spyder'],
  'Vanden Plas': ['1100', '1300', '1500', 'Princess'],
  'VRS': ['Roadster'],
  'Westfield': ['FW', 'SEiW', 'Sport 250', 'XI'],
  'Wiesmann': ['MF3', 'MF4', 'MF5'],
  'Wolseley': ['6/110', '16/60', '18/85', '1500', 'Hornet'],
  'Yugo': ['45', '55', 'Sana'],
  'Zastava': ['101', '750', 'Yugo'],
  'Zenos': ['E10'],
}
for (const [make, models] of Object.entries(EXTRA_MODELS_BY_MAKE)) {
  MODELS_BY_MAKE[make] = Array.from(new Set([...(MODELS_BY_MAKE[make] || []), ...models]))
}

/**
 * Common trim/variant options per model.
 * Used to show a dropdown instead of free text when a match is found.
 * Key format: "Make|Model" (pipe-separated, lowercase-normalised at runtime).
 */
export const VARIANTS_BY_MODEL: Record<string, string[]> = {
  // ── Abarth ────────────────────────────────────────────────────────
  'Abarth|500': ['500', 'Esseesse'],
  'Abarth|595': ['595', 'Turismo', 'Competizione', 'Esseesse', 'Pista'],

  // ── Alfa Romeo ────────────────────────────────────────────────────
  'Alfa Romeo|Giulia': ['2.0T 200 Sprint', '2.0T 280 Veloce', '2.0T 280 Super', '2.9 V6 Bi-Turbo Quadrifoglio'],
  'Alfa Romeo|Giulietta': [
    'Progression', 'Distinctive', 'Lusso', 'Super', 'Sportiva', 'Speciale', 'Tecnica', 'Veloce', 'Quadrifoglio Verde',
  ],
  'Alfa Romeo|MiTo': [
    'Progression', 'Distinctive', 'Lusso', 'Super', 'Sportiva', 'Speciale', 'Veloce', 'Quadrifoglio Verde',
  ],
  'Alfa Romeo|Stelvio': ['2.0T 200 Sprint', '2.0T 280 Veloce', '2.0T 280 Super', '2.9 V6 Bi-Turbo Quadrifoglio'],
  'Alfa Romeo|Tonale': ['1.5T MHEV Sprint', '1.3 PHEV Sprint', '1.5T MHEV Veloce', '1.3 PHEV Veloce'],

  // ── Audi ──────────────────────────────────────────────────────────
  'Audi|A1': ['SE', 'Sport', 'S line', 'Black Edition', 'Technik', 'Competition', 'Vorsprung', 'Citycarver', 'S1'],
  'Audi|A3': [
    '1.0 TFSI Sport', '1.5 TFSI Sport', '1.5 TFSI S line', '2.0 TFSI S line', '30 TFSI Sport', '35 TFSI S line',
    '40 TFSI S line', '30 TDI Sport', '35 TDI S line', 'S3', 'RS3', 'SE', 'SE Technik', 'Sport', 'S line',
    'Black Edition', 'Technik', 'Vorsprung', 'Edition 1', '30 TFSI', '35 TFSI', '40 TFSI e', '30 TDI', '35 TDI',
  ],
  'Audi|A4': [
    '35 TFSI Sport', '35 TFSI S line', '40 TFSI S line', '40 TFSI Black Edition', '35 TDI Sport', '35 TDI S line',
    '40 TDI S line', '40 TDI Black Edition', 'S4', 'RS4', 'SE', 'SE Technik', 'Sport', 'S line', 'Black Edition',
    'Technik', 'Sport Edition', 'Vorsprung', 'Edition 1', '35 TFSI', '40 TFSI', '35 TDI', '40 TDI',
  ],
  'Audi|A5': [
    'SE', 'Sport', 'S line', 'Black Edition', 'Technik', 'Sport Edition', 'Vorsprung', 'Edition 1', '35 TFSI',
    '40 TFSI', '35 TDI', '40 TDI', 'S5', 'RS5',
  ],
  'Audi|A6': [
    '40 TFSI Sport', '40 TDI S line', '45 TFSI S line', '45 TDI quattro S line', '55 TFSI S line', 'S6', 'RS6', 'SE',
    'SE Executive', 'Sport', 'S line', 'Black Edition', 'Vorsprung', '40 TDI', '45 TDI', '50 TDI', '50 TFSI e',
    '55 TFSI e',
  ],
  'Audi|e-tron': ['Launch Edition', 'Sport', 'S line', 'Black Edition', 'Vorsprung', '50 quattro', '55 quattro', 'S'],
  'Audi|Q2': [
    'SE', 'Sport', 'S line', 'Black Edition', 'Technik', 'Edition 1', 'Vorsprung', '30 TFSI', '35 TFSI', '30 TDI',
    'SQ2',
  ],
  'Audi|Q3': [
    '35 TFSI Sport', '35 TFSI S line', '45 TFSI quattro S line', '35 TDI Sport', '35 TDI S line',
    '45 TDI quattro S line', 'SE', 'Sport', 'S line', 'Black Edition', 'Technik', 'Edition 1', 'Vorsprung', '35 TFSI',
    '40 TFSI', '45 TFSI e', '35 TDI', 'RS Q3',
  ],
  'Audi|Q4 e-tron': [
    'Sport', 'S line', 'Edition 1', 'Black Edition', 'Vorsprung', '35', '40', '45 quattro', '50 quattro',
  ],
  'Audi|Q5': [
    '35 TFSI Sport', '40 TDI S line', '45 TFSI quattro S line', '50 TDI quattro S line', '55 TFSI e S line', 'SQ5',
    'SE', 'Sport', 'S line', 'Black Edition', 'Vorsprung', 'Edition 1', '40 TDI', '45 TFSI', '50 TFSI e', '55 TFSI e',
  ],
  'Audi|Q7': ['SE', 'Sport', 'S line', 'Black Edition', 'Vorsprung', '45 TDI', '50 TDI', '55 TFSI e', 'SQ7'],
  'Audi|Q8': ['S line', 'Black Edition', 'Vorsprung', '50 TDI', '55 TFSI', 'SQ8', 'RS Q8'],
  'Audi|TT': ['Sport', 'S line', 'Black Edition', 'Final Edition', 'Vorsprung', 'TTS', 'TT RS'],

  // ── BMW ───────────────────────────────────────────────────────────
  'BMW|1 Series': [
    '116i SE', '116d SE', '118i Sport', '118i M Sport', '116d Sport', '118d Sport', '118d M Sport', 'M135i xDrive',
    'ES', 'SE', 'Sport', 'Urban', 'M Sport', 'M Sport Shadow Edition', '116i ES', '118i SE', '120i M Sport',
    '120d M Sport', '125i M Sport', '125d M Sport', '128ti', 'M140i',
  ],
  'BMW|2 Series': ['SE', 'Sport', 'Luxury', 'M Sport', '218i', '220i', '220d', '230i', 'M240i'],
  'BMW|2 Series Active Tourer': ['SE', 'Sport', 'Luxury', 'M Sport', '225xe', '230e'],
  'BMW|3 Series': [
    '318i SE', '320i Sport', '320i M Sport', '320i xDrive', '330i M Sport', '330e M Sport', '318d SE', '320d Sport',
    '320d M Sport', '330d M Sport', 'M340i xDrive', 'ES', 'SE', 'Sport', 'Luxury', 'Modern', 'M Sport', '316i',
    '316d', '320i', '320d', '325i', '330i', '330d', '330e', '335i', '335d', '340i M Sport',
  ],
  'BMW|3 Series Touring': [
    '318i SE', '320i Sport', '320i M Sport', '318d SE', '320d Sport', '320d M Sport', '330d M Sport', 'M340i xDrive',
  ],
  'BMW|4 Series': [
    '420i Sport', '420i M Sport', '430i M Sport', '420d Sport', '420d M Sport', '430d M Sport', 'M440i xDrive', 'SE',
    'Sport', 'Luxury', 'M Sport', '420i', '420d', '430i', '430d', '435i', '435d', '440i',
  ],
  'BMW|5 Series': [
    '520i SE', '520i Sport', '520i M Sport', '530i M Sport', '530e M Sport', '520d SE', '520d Sport', '520d M Sport',
    '530d M Sport', '540i xDrive', 'M550i xDrive', 'SE', 'Luxury', 'Sport', 'Modern', 'M Sport', '520d', '525d',
    '530d', '535d', '520i', '530i', '540i', '530e',
  ],
  'BMW|i3': ['i3', 'i3 Range Extender', 'i3s', '60Ah', '94Ah', '120Ah'],
  'BMW|i4': ['eDrive35', 'eDrive40', 'xDrive40', 'M50'],
  'BMW|iX': ['xDrive40', 'xDrive50', 'M60'],
  'BMW|iX1': ['eDrive20', 'xDrive30', 'Sport', 'M Sport'],
  'BMW|M3': ['M3', 'M3 Competition', 'M3 Competition xDrive', 'M3 Touring Competition xDrive'],
  'BMW|M4': ['M4 Competition', 'M4 Competition xDrive', 'M4 Competition Convertible', 'M4 CSL'],
  'BMW|X1': [
    'SE', 'Sport', 'xLine', 'M Sport', 'sDrive18i', 'sDrive20i', 'sDrive18d', 'sDrive20d', 'xDrive20d', 'xDrive25e',
  ],
  'BMW|X2': ['SE', 'Sport', 'M Sport', 'M Sport X', 'M35i', 'xDrive25e'],
  'BMW|X3': [
    'xDrive20i SE', 'xDrive20i Sport', 'xDrive20i M Sport', 'xDrive30i M Sport', 'xDrive20d SE', 'xDrive20d Sport',
    'xDrive20d M Sport', 'xDrive30d M Sport', 'xDrive30e M Sport', 'SE', 'xLine', 'M Sport',
  ],
  'BMW|X4': ['M Sport', 'xDrive20d', 'xDrive30d', 'M40i', 'M40d'],
  'BMW|X5': [
    'xDrive40i SE', 'xDrive40i M Sport', 'xDrive30d SE', 'xDrive30d M Sport', 'xDrive40d M Sport',
    'xDrive45e M Sport', 'M50i', 'M50d',
  ],
  'BMW|X6': ['M Sport', 'xDrive30d', 'xDrive40d', 'xDrive40i', 'M50d', 'M50i'],
  'BMW|X7': ['M Sport', 'xDrive40i', 'xDrive40d', 'M50d', 'M60i'],
  'BMW|Z4': [
    '2.0i', '2.5i', '3.0i', '3.0si', 'sDrive18i', 'sDrive20i', 'sDrive23i', 'sDrive35i', 'sDrive35is',
    'sDrive20i Sport', 'sDrive20i M Sport', 'sDrive30i M Sport', 'M40i',
  ],

  // ── BYD ───────────────────────────────────────────────────────────
  'BYD|Atto 3': ['Active', 'Comfort', 'Design'],
  'BYD|Dolphin': ['Active', 'Boost', 'Comfort', 'Design'],
  'BYD|Seal': ['Design', 'Excellence'],
  'BYD|Sealion 7': ['Comfort', 'Design', 'Excellence'],

  // ── Citroën ───────────────────────────────────────────────────────
  'Citroën|Berlingo': ['Touch', 'Feel', 'Flair', 'Feel XTR', 'Flair XTR', 'Sense', 'Shine', 'Plus', 'Max'],
  'Citroën|C1': ['Vibe', 'Rhythm', 'VTR', 'Edition', 'Touch', 'Feel', 'Flair', 'Shine', 'Urban Ride', 'Airscape'],
  'Citroën|C3': [
    'PureTech 82 Feel', 'PureTech 110 Flair', 'ë-C3 You!', 'ë-C3 Plus', 'VT', 'VTR+', 'Exclusive', 'Selection',
    'Edition', 'Touch', 'Feel', 'Flair', 'Flair Plus', 'Shine', 'Shine Plus', 'Plus', 'Max',
  ],
  'Citroën|C3 Aircross': [
    'PureTech 110 Feel', 'PureTech 130 Flair', 'Shine', 'Touch', 'Feel', 'Flair', 'Sense', 'Sense Plus', 'Shine Plus',
    'Plus', 'Max', 'C-Series',
  ],
  'Citroën|C4': [
    'VTR', 'VTR+', 'Exclusive', 'Exclusive+', 'Selection', 'Edition', 'Touch', 'Feel', 'Flair', 'Sense', 'Sense Plus',
    'Shine', 'Shine Plus', 'Plus', 'Max', 'C-Series',
  ],
  'Citroën|C4 Cactus': ['Touch', 'Feel', 'Flair', 'Rip Curl', 'Sense', 'Shine'],
  'Citroën|C4 Picasso': ['VTR+', 'Exclusive', 'Exclusive+', 'Edition', 'Selection', 'Touch', 'Feel', 'Flair'],
  'Citroën|C5 Aircross': [
    'PureTech 130 Feel', 'BlueHDi 130 Flair+', 'Hybrid 225 Shine', 'Plug-in Hybrid 225 Shine', 'Feel', 'Flair',
    'Flair Plus', 'Sense', 'Sense Plus', 'Shine', 'Shine Plus', 'Plus', 'Max', 'C-Series',
  ],
  'Citroën|DS3': ['DSign', 'DStyle', 'DStyle Plus', 'DSport', 'DSport Plus', 'Racing'],
  'Citroën|Grand C4 Picasso': ['VTR+', 'Exclusive', 'Exclusive+', 'Edition', 'Selection', 'Touch', 'Feel', 'Flair'],

  // ── Cupra ─────────────────────────────────────────────────────────
  'Cupra|Born': ['58kWh', '77kWh', '82kWh Performance', 'e-Boost', 'V1', 'V2', 'V3', 'VZ'],
  'Cupra|Formentor': [
    '1.5 TSI 150', '2.0 TSI 190', '2.0 TSI 245', '2.0 TSI 310 4Drive', 'e-Hybrid 204', 'e-Hybrid 245', 'V1', 'V2',
    'V3', 'VZ1', 'VZ2', 'VZ3', 'VZ Edition', 'e-Hybrid',
  ],
  'Cupra|Leon': [
    '1.5 TSI 150', '2.0 TSI 245', '2.0 TSI 300', 'e-Hybrid 204', 'e-Hybrid 245', 'V1', 'V2', 'V3', 'VZ1', 'VZ2',
    'VZ3', 'Cupra 300', 'e-Hybrid',
  ],

  // ── Dacia ─────────────────────────────────────────────────────────
  'Dacia|Duster': [
    '1.0 TCe 90 Essential', '1.5 Blue dCi 115 SE Twenty', '1.3 TCe 130 SE Twenty', '1.3 TCe 130 Journey', 'Extreme',
    'Access', 'Ambiance', 'Laureate', 'Prestige', 'Comfort', 'Essential', 'Expression', 'Journey',
  ],
  'Dacia|Jogger': [
    '1.0 TCe 110 Essential', '1.0 TCe 110 Comfort', '1.0 TCe 110 Extreme', '1.6 Hybrid 140', 'Essential',
    'Expression', 'Journey', 'Extreme', 'Extreme SE',
  ],
  'Dacia|Logan MCV': ['Access', 'Ambiance', 'Laureate', 'Essential', 'Comfort'],
  'Dacia|Sandero': [
    '1.0 TCe 90 Essential', '1.0 TCe 90 Comfort', '1.0 TCe 110 Extreme', '1.0 TCe 110 Bi-Fuel', 'Access', 'Ambiance',
    'Laureate', 'Essential', 'Comfort', 'Expression', 'Journey', 'Extreme',
  ],
  'Dacia|Sandero Stepway': [
    'Ambiance', 'Laureate', 'Essential', 'Comfort', 'Prestige', 'Expression', 'Journey', 'Extreme',
  ],
  'Dacia|Spring': ['Comfort', 'Comfort Plus', 'Expression', 'Extreme'],

  // ── DS ────────────────────────────────────────────────────────────
  'DS|DS 3 Crossback': ['Elegance', 'Performance Line', 'Prestige', 'Ultra Prestige', 'La Premiere'],
  'DS|DS 7 Crossback': ['Elegance', 'Performance Line', 'Prestige', 'Ultra Prestige', 'Rivoli', 'La Premiere'],

  // ── Fiat ──────────────────────────────────────────────────────────
  'Fiat|500': [
    'Pop', 'Pop Star', 'Lounge', 'Sport', 'Rock', 'Star', 'S', 'Cult', 'Collezione', 'Riva', 'Dolcevita', 'Connect',
    'Red', 'Hey Google', 'Top',
  ],
  'Fiat|500L': ['Pop Star', 'Lounge', 'Cross', 'Trekking', 'Urban', 'Connect', 'Sport', 'Mirror'],
  'Fiat|500X': [
    'Pop', 'Pop Star', 'Lounge', 'Cross', 'Cross Plus', 'City Cross', 'Sport', 'Connect', 'Dolcevita', 'Red',
  ],
  'Fiat|Panda': [
    'Pop', 'Easy', 'Lounge', 'Cross', 'City Cross', '4x4', '100HP', 'Active', 'Dynamic', 'Eleganza', 'Life', 'Sport',
  ],
  'Fiat|Punto': ['Active', 'Dynamic', 'Eleganza', 'Sporting', 'HGT', 'Pop', 'Easy', 'Lounge', 'GP'],
  'Fiat|Tipo': ['Easy', 'Easy Plus', 'Lounge', 'Mirror', 'Street', 'Sport', 'Cross', 'Life'],

  // ── Ford ──────────────────────────────────────────────────────────
  'Ford|B-Max': ['Studio', 'Style', 'Zetec', 'Titanium'],
  'Ford|C-Max': ['Studio', 'Style', 'Zetec', 'Titanium', 'Titanium X', 'Edge', 'Ghia'],
  'Ford|EcoSport': ['Zetec', 'Titanium', 'Titanium S', 'ST-Line', 'Active'],
  'Ford|Edge': ['Zetec', 'Titanium', 'Sport', 'ST-Line', 'Vignale'],
  'Ford|Fiesta': [
    '1.1 Ti-VCT Zetec', '1.0T EcoBoost Zetec', '1.0T EcoBoost ST-Line', '1.0T EcoBoost Titanium', '1.5T EcoBoost ST',
    '1.5T EcoBoost ST-2', '1.5 TDCi Zetec', '1.5 TDCi Titanium', 'Studio', 'Style', 'Edge', 'Zetec', 'Zetec S',
    'Zetec Red', 'Zetec Blue', 'Titanium', 'Titanium X', 'ST-Line', 'ST-Line X', 'ST-Line Edition', 'Vignale',
    'Active', 'Active X', 'Trend', 'Ghia', 'LX', 'Flame', 'Finesse', 'Freestyle', 'Encore', 'Econetic',
    'Black Edition', 'Red Edition', 'Graphite', 'ST', 'ST-1', 'ST-2', 'ST-3', 'XR2i',
  ],
  'Ford|Focus': [
    '1.0T EcoBoost Zetec', '1.0T EcoBoost ST-Line', '1.0T EcoBoost ST-Line X', '1.0T EcoBoost Titanium',
    '1.5T EcoBoost ST', '1.5 EcoBlue ST-Line', '1.5 EcoBlue Titanium', '2.3T EcoBoost ST', 'ST-3', 'Studio', 'Style',
    'Edge', 'Zetec', 'Zetec S', 'Zetec Edition', 'Ghia', 'LX', 'CL', 'Sport', 'Titanium', 'Titanium X',
    'Titanium Edition', 'Titanium Navigation', 'ST-Line', 'ST-Line X', 'ST-Line Edition', 'ST-Line Vignale',
    'Vignale', 'Active', 'Active X', 'Active Edition', 'Trend', 'ST', 'ST-2', 'RS', 'RS500',
  ],
  'Ford|Fusion': ['Style', 'Zetec', 'Titanium', 'Studio', 'Plus'],
  'Ford|Galaxy': ['LX', 'Zetec', 'Ghia', 'Titanium', 'Titanium X', 'Edge', 'Style', 'Vignale'],
  'Ford|Grand C-Max': ['Style', 'Zetec', 'Titanium', 'Titanium X', 'Edge'],
  'Ford|Ka': ['Studio', 'Style', 'Edge', 'Zetec', 'Titanium', 'Grand Prix', 'Collection', 'Luxury', 'Metal'],
  'Ford|Ka+': ['Studio', 'Zetec', 'Zetec Black Edition', 'Active'],
  'Ford|Kuga': [
    '1.5T EcoBoost Zetec', '1.5T EcoBoost ST-Line', '1.5T EcoBoost Titanium', '2.5 Duratec FHEV ST-Line',
    '2.5 Duratec FHEV Titanium', '2.5 PHEV ST-Line', '2.5 PHEV Titanium', 'Zetec', 'Titanium', 'Titanium X',
    'Titanium Edition', 'Titanium X Sport', 'ST-Line', 'ST-Line X', 'ST-Line Edition', 'Vignale', 'Active', 'Hybrid',
    'Plug-in Hybrid',
  ],
  'Ford|Mondeo': [
    'LX', 'GLX', 'Ghia', 'Ghia X', 'Zetec', 'Zetec S', 'Edge', 'Titanium', 'Titanium X', 'Titanium X Sport',
    'ST-Line', 'Vignale', 'Sport', 'Hybrid Titanium', 'ST24', 'ST200', 'ST220',
  ],
  'Ford|Mustang': [
    '2.3T EcoBoost Fastback', '5.0 V8 GT Fastback', '5.0 V8 GT Convertible', '5.0 V8 Dark Horse', 'Mach 1',
  ],
  'Ford|Mustang Mach-E': [
    'Standard Range RWD', 'Extended Range RWD', 'Extended Range AWD', 'Select', 'Premium', 'GT',
  ],
  'Ford|Puma': [
    '1.0T EcoBoost Zetec', '1.0T EcoBoost ST-Line', '1.0T EcoBoost ST-Line X', '1.0T EcoBoost Titanium',
    '1.0T EcoBoost mHEV ST-Line', '1.5T EcoBoost ST', 'Titanium', 'ST-Line', 'ST-Line X', 'ST-Line Vignale',
    'ST-Line Design', 'ST', 'Hybrid',
  ],
  'Ford|Ranger': ['XL', 'XLT', 'Limited', 'Wildtrak', 'Raptor', 'Tremor', 'Stormtrak', 'Thunder', 'Platinum'],
  'Ford|S-Max': ['Zetec', 'Titanium', 'Titanium X', 'Titanium Sport', 'ST-Line', 'Vignale', 'Edge'],
  'Ford|Transit': ['Base', 'Leader', 'Trend', 'Limited', 'Trail'],
  'Ford|Transit Connect': ['Base', 'Leader', 'Trend', 'Limited', 'Sport', 'Active'],
  'Ford|Transit Custom': ['Base', 'Leader', 'Trend', 'Limited', 'Sport', 'Trail', 'Active'],

  // ── Honda ─────────────────────────────────────────────────────────
  'Honda|Civic': [
    '1.0T VTEC Turbo SE', '1.0T VTEC Turbo SR', '1.5T VTEC Turbo Sport', '1.5 e:HEV Elegance', '1.5 e:HEV Advance',
    '1.5 e:HEV Sport', '2.0T Type R', '2.0T Type R GT', 'S', 'SE', 'SE Plus', 'ES', 'EX', 'EX Sport', 'SR', 'Sport',
    'Sport Plus', 'Prestige', 'Elegance', 'Advance', 'Type S', 'Type R', 'Type R GT',
  ],
  'Honda|CR-V': [
    '1.5T VTEC SE', '1.5T VTEC Sport', '1.5T VTEC EX', '2.0 Hybrid SE', '2.0 Hybrid Sport', '2.0 Hybrid EX',
    '2.0 e:PHEV Advance', '2.0 e:PHEV Sport', 'S', 'SE', 'SE Plus', 'SR', 'ES', 'EX', 'Elegance', 'Sport Line',
    'Advance',
  ],
  'Honda|HR-V': [
    '1.5 i-MMD Elegance', '1.5 i-MMD Advance', '1.5 i-MMD Advance Sport', 'S', 'SE', 'SR', 'EX', 'Sport', 'Elegance',
    'Advance', 'Advance Style',
  ],
  'Honda|Jazz': [
    '1.5 i-MMD Elegance', '1.5 i-MMD Advance', '1.5 i-MMD Sport', '1.5 i-MMD EX', 'S', 'SE', 'SE Navi', 'ES', 'EX',
    'Si', 'Sport', 'Elegance', 'Crosstar', 'Advance',
  ],

  // ── Hyundai ───────────────────────────────────────────────────────
  'Hyundai|Bayon': ['SE Connect', 'Premium', 'Ultimate', 'Advance'],
  'Hyundai|i10': [
    'Classic', 'Comfort', 'Style', 'S', 'SE', 'SE Connect', 'Premium', 'Premium SE', 'Go', 'Play', 'Advance',
    'N Line',
  ],
  'Hyundai|i20': [
    'Classic', 'Active', 'Comfort', 'Style', 'S', 'SE', 'SE Connect', 'Premium', 'Premium SE', 'Play', 'Go SE',
    'N Line', 'N Line S', 'Ultimate', 'Advance', 'N',
  ],
  'Hyundai|i30': [
    '1.0T GDi SE Connect', '1.0T GDi Premium', '1.5T GDi N Line', '1.6 CRDi SE Connect', '1.6 CRDi Premium',
    '2.0T N Performance', '2.0T N Line S', 'Classic', 'Comfort', 'Active', 'Style', 'S', 'SE', 'SE Nav', 'SE Connect',
    'Premium', 'Premium SE', 'Go SE', 'N Line', 'N Line S', 'N Line+', 'Turbo', 'N', 'N Performance',
  ],
  'Hyundai|Ioniq': ['SE', 'Premium', 'Premium SE', 'Hybrid', 'Plug-in', 'Electric'],
  'Hyundai|Ioniq 5': [
    '58kWh Standard Range', '73kWh RWD', '73kWh AWD', '77.4kWh RWD', '77.4kWh AWD', 'N', 'SE Connect', 'Premium',
    'Ultimate', 'Advance', 'N Line', 'Long Range',
  ],
  'Hyundai|ix35': ['S', 'SE', 'SE Nav', 'Style', 'Premium', 'Premium Nav'],
  'Hyundai|Kona': [
    '1.0T GDi SE Connect', '1.0T GDi Premium', '1.6 CRDi SE Connect', 'Electric 39kWh SE', 'Electric 64kWh Premium',
    'Electric 64kWh N Line', 'N', 'S', 'SE', 'SE Connect', 'Premium', 'Premium SE', 'Play', 'N Line', 'N Line S',
    'Ultimate', 'Advance',
  ],
  'Hyundai|Santa Fe': [
    '1.6T PHEV SE Connect', '1.6T PHEV Premium', '2.2 CRDi SE Connect', '2.2 CRDi Premium', 'SE', 'Style', 'Premium',
    'Premium SE', 'Ultimate',
  ],
  'Hyundai|Tucson': [
    '1.6T GDi SE Connect', '1.6T GDi Premium', '1.6T GDi N Line', '1.6 CRDi SE Connect', '1.6 CRDi Premium',
    '1.6T Hybrid Premium', '1.6T Hybrid N Line', '1.6T PHEV Premium', 'S', 'SE', 'SE Connect', 'SE Nav', 'Premium',
    'Premium SE', 'Sport Edition', 'Go SE', 'N Line', 'N Line S', 'Ultimate', 'Advance',
  ],

  // ── Jaguar ────────────────────────────────────────────────────────
  'Jaguar|E-Pace': [
    'S', 'SE', 'HSE', 'R-Dynamic S', 'R-Dynamic SE', 'R-Dynamic HSE', 'R-Dynamic Black', '300 Sport',
    'Chequered Flag', 'First Edition',
  ],
  'Jaguar|F-Pace': [
    '2.0 P250 R-Dynamic SE', '2.0 D200 R-Dynamic SE', '3.0 P400 HSE', '5.0 V8 SVR', 'Prestige', 'Portfolio',
    'R-Sport', 'S', 'R-Dynamic S', 'R-Dynamic SE', 'R-Dynamic HSE', 'R-Dynamic Black', '300 Sport', 'Chequered Flag',
    'First Edition', 'Landmark Edition', 'SVR',
  ],
  'Jaguar|F-Type': ['2.0T R-Dynamic', '3.0 S/C V6 R-Dynamic', '5.0 V8 R', '5.0 V8 R AWD', '5.0 V8 SVR'],
  'Jaguar|I-Pace': ['EV400 SE', 'EV400 HSE', 'EV400 SE Black', 'EV400 HSE Black'],
  'Jaguar|XE': [
    'SE', 'Prestige', 'Portfolio', 'R-Sport', 'S', 'R-Dynamic', 'R-Dynamic SE', 'R-Dynamic HSE', 'R-Dynamic Black',
    '300 Sport', 'Landmark Edition',
  ],
  'Jaguar|XF': [
    'SE', 'Luxury', 'Premium Luxury', 'Sport', 'Prestige', 'Portfolio', 'R-Sport', 'S', 'R-Dynamic SE',
    'R-Dynamic HSE', 'R-Dynamic Black', '300 Sport', 'Chequered Flag', 'XFR', 'XFR-S',
  ],
  'Jaguar|XJ': ['Luxury', 'Premium Luxury', 'Portfolio', 'R-Sport', 'Autobiography', 'XJR', 'XJR575'],

  // ── Jeep ──────────────────────────────────────────────────────────
  'Jeep|Avenger': ['Longitude', 'Altitude', 'Summit', '1st Edition'],
  'Jeep|Compass': ['Sport', 'Longitude', 'Limited', 'Trailhawk', 'Night Eagle', 'S', 'Upland'],
  'Jeep|Renegade': ['Sport', 'Longitude', 'Limited', 'Trailhawk', 'Night Eagle', 'S', 'Upland'],
  'Jeep|Wrangler': ['Sport', 'Sahara', 'Rubicon', 'Overland', 'Night Eagle'],

  // ── Kia ───────────────────────────────────────────────────────────
  'Kia|Ceed': [
    '1.0T GDi SE', '1.0T GDi SE Connect', '1.4T GDi GT-Line', '1.6 CRDi SE Connect', '1.6 CRDi GT-Line', '1', '2',
    '3', '4', 'GT-Line', 'GT-Line S', 'GT',
  ],
  'Kia|EV6': [
    '58kWh Air', '77.4kWh Air', '77.4kWh GT-Line', '77.4kWh GT-Line S', '77.4kWh GT AWD', 'Air', 'GT-Line',
    'GT-Line S', 'GT',
  ],
  'Kia|Niro': [
    '1.6 GDi HEV SE', '1.6 GDi HEV GT-Line', '1.6 GDi PHEV SE', '1.6 GDi PHEV GT-Line', 'EV 64.8kWh SE',
    'EV 64.8kWh GT-Line', '2', '3', '4', 'First Edition',
  ],
  'Kia|Niro EV': ['2', '3', '4', 'First Edition'],
  'Kia|Optima': ['2', '3', '4', 'GT-Line', 'GT-Line S'],
  'Kia|Picanto': [
    '1.0 SE', '1.0 SE Connect', '1.0 GT-Line', '1.25 SE Connect', '1.25 GT-Line', '1', '2', '3', '4', 'City',
    'GT-Line', 'GT-Line S', 'X-Line', 'X-Line S',
  ],
  'Kia|Rio': ['1', '2', '3', '4', '1 Air', 'GT-Line', 'GT-Line S'],
  'Kia|Sorento': ['2', '3', '4', 'KX-1', 'KX-2', 'KX-3', 'KX-4', 'GT-Line', 'GT-Line S'],
  'Kia|Soul': ['1', '2', '3', 'Start', 'Connect', 'Connect Plus', 'Mixx', 'Maxx', 'First Edition'],
  'Kia|Sportage': [
    '1.0T GDi SE', '1.5T GDi SE Connect', '1.5T GDi GT-Line', '1.6 CRDi SE Connect', '1.6 CRDi GT-Line',
    '1.6T Hybrid GT-Line', '1.6T PHEV GT-Line S', '1', '2', '3', '4', 'KX-1', 'KX-2', 'KX-3', 'KX-4', 'KX-5',
    'GT-Line', 'GT-Line S', 'First Edition', 'Black Edition',
  ],
  'Kia|Stonic': ['1', '2', '3', 'First Edition', 'GT-Line', 'GT-Line S'],
  'Kia|Venga': ['1', '2', '3', '4'],
  'Kia|Xceed': ['2', '3', '4', 'First Edition', 'GT-Line', 'GT-Line S'],

  // ── Land Rover ────────────────────────────────────────────────────
  'Land Rover|Defender': [
    'S', 'SE', 'HSE', 'X', 'X-Dynamic S', 'X-Dynamic SE', 'X-Dynamic HSE', 'First Edition', 'Hard Top', 'V8', 'Octa',
  ],
  'Land Rover|Defender 90': [
    '2.0 P300 S', '2.0 P300 SE', '3.0 P400 HSE', '3.0 P400 X', '3.0 D300 HSE', 'Carpathian Edition',
  ],
  'Land Rover|Defender 110': [
    '2.0 P300 S', '2.0 P300 SE', '3.0 P400 HSE', '3.0 P400 X', '3.0 D300 HSE', 'Carpathian Edition', 'First Edition',
  ],
  'Land Rover|Discovery': [
    'D250 SE', 'D300 SE', 'D300 HSE', 'D300 R-Dynamic HSE', 'D300 Autobiography', 'P360 Autobiography', 'GS', 'XS',
    'S', 'SE', 'HSE', 'HSE Luxury', 'Landmark', 'First Edition', 'Metropolitan Edition', 'R-Dynamic S',
    'R-Dynamic SE', 'R-Dynamic HSE', 'Commercial',
  ],
  'Land Rover|Discovery Sport': [
    'S', 'SE', 'SE Tech', 'HSE', 'HSE Luxury', 'HSE Black', 'Pure', 'Landmark', 'Dynamic SE', 'R-Dynamic S',
    'R-Dynamic SE', 'R-Dynamic HSE',
  ],
  'Land Rover|Freelander 2': ['S', 'GS', 'XS', 'SE', 'HSE', 'Metropolis', 'Dynamic'],
  'Land Rover|Range Rover': [
    '2.0 P400e SE', '3.0 D300 SE', '3.0 D350 Autobiography', '4.4 P530 SV', 'SWB Autobiography',
    'LWB Autobiography Extended', 'SE', 'HSE', 'Vogue', 'Vogue SE', 'Westminster', 'Autobiography', 'SVAutobiography',
    'Fifty', 'First Edition', 'SV',
  ],
  'Land Rover|Range Rover Evoque': [
    'Pure', 'Pure Tech', 'Prestige', 'Dynamic', 'SE', 'SE Dynamic', 'HSE', 'HSE Dynamic', 'Autobiography', 'Landmark',
    'Bronze Collection', 'First Edition', 'R-Dynamic', 'R-Dynamic S', 'R-Dynamic SE', 'R-Dynamic HSE',
  ],
  'Land Rover|Range Rover Sport': [
    '2.0 P400e SE', '3.0 D300 SE', '3.0 D350 HSE', '3.0 D350 Autobiography', '4.4 P530 SVR', 'First Edition', 'S',
    'SE', 'HSE', 'HSE Dynamic', 'Autobiography', 'Autobiography Dynamic', 'Dynamic SE', 'Dynamic HSE', 'HST', 'SVR',
    'SV',
  ],
  'Land Rover|Range Rover Velar': [
    'S', 'SE', 'HSE', 'First Edition', 'R-Dynamic', 'R-Dynamic S', 'R-Dynamic SE', 'R-Dynamic HSE', 'Dynamic SE',
    'Dynamic HSE', 'SVAutobiography Dynamic Edition',
  ],

  // ── Lexus ─────────────────────────────────────────────────────────
  'Lexus|IS': ['300h Executive', '300h Advance', '300h F Sport', '300h Takumi', '300h Sport'],
  'Lexus|NX': ['350h E-Four Premium', '350h E-Four Takumi', '450h+ F Sport', '450h+ Takumi'],
  'Lexus|RX': ['350h E-Four Premium', '350h E-Four Takumi', '450h+ F Sport', '500h F Sport Performance'],
  'Lexus|UX': ['250h Premium', '250h F Sport', '250h Takumi', '300e Premium', '300e Takumi'],

  // ── Mazda ─────────────────────────────────────────────────────────
  'Mazda|2': [
    'TS', 'SE', 'SE-L', 'SE-L Nav', 'Sport', 'Sport Nav', 'Sport Black', 'GT Sport', 'GT Sport Nav', 'Homura',
    'Exclusive-Line', 'Centre-Line', 'Prime-Line',
  ],
  'Mazda|3': [
    '2.0 SKYACTIV-G SE-L', '2.0 SKYACTIV-G Sport Black', '2.0 SKYACTIV-G GT Sport', 'e-SKYACTIV X', 'Fastback', 'TS',
    'TS2', 'SE', 'SE-L', 'SE-L Nav', 'SE-L Lux', 'Sport', 'Sport Nav', 'Sport Lux', 'GT Sport', 'GT Sport Tech',
    'Exclusive-Line', 'Centre-Line', 'Prime-Line', 'Homura', 'MPS',
  ],
  'Mazda|6': ['TS', 'TS2', 'SE', 'SE-L', 'SE-L Nav', 'Sport', 'Sport Nav', 'GT Sport', 'GT Sport Nav', 'Kuro', 'MPS'],
  'Mazda|CX-3': ['SE', 'SE-L', 'SE-L Nav', 'Sport', 'Sport Nav', 'GT Sport', 'GT Sport Nav'],
  'Mazda|CX-5': [
    '2.0 SKYACTIV-G SE-L', '2.0 SKYACTIV-G Sport Black', '2.0 SKYACTIV-G GT Sport', '2.2 SKYACTIV-D SE-L',
    '2.2 SKYACTIV-D Sport Black', '2.2 SKYACTIV-D GT Sport Tech', 'SE-L', 'SE-L Nav', 'SE-L Lux', 'Sport',
    'Sport Nav', 'Sport Black', 'GT Sport', 'GT Sport Nav', 'Newground', 'Homura', 'Exclusive-Line', 'Centre-Line',
  ],
  'Mazda|CX-30': [
    '2.0 SKYACTIV-G Pure', '2.0 SKYACTIV-G SE-L', '2.0 SKYACTIV-G GT Sport', 'e-SKYACTIV X',
    'e-SKYACTIV X GT Sport Tech', 'SE-L', 'SE-L Lux', 'Sport Lux', 'GT Sport', 'GT Sport Tech', 'Exclusive-Line',
    'Centre-Line', 'Prime-Line', 'Homura',
  ],
  'Mazda|CX-60': ['Exclusive-Line', 'Homura', 'Takumi'],
  'Mazda|MX-5': [
    '1.5 SKYACTIV-G Sport Nav', '2.0 SKYACTIV-G Sport Nav', '2.0 SKYACTIV-G GT Sport Nav', '2.0 SKYACTIV-G Roadster',
    '2.0 RF Sport Nav', 'SE', 'SE-L', 'SE-L Nav', 'Sport', 'Sport Nav', 'Sport Tech', 'Sport Nav+', 'GT Sport',
    'GT Sport Nav', 'Exclusive-Line', 'Prime-Line', 'Homura',
  ],

  // ── Mercedes-Benz ─────────────────────────────────────────────────
  'Mercedes-Benz|A-Class': [
    'A 180 SE', 'A 180 Sport', 'A 180 AMG Line', 'A 200 AMG Line', 'A 220 AMG Line', 'A 180d SE', 'A 180d AMG Line',
    'A 200d AMG Line', 'A 250 AMG Line', 'Classic', 'Classic SE', 'Elegance', 'Avantgarde', 'Avantgarde SE', 'SE',
    'Sport', 'Sport Executive', 'AMG Line', 'AMG Line Premium', 'AMG Line Premium Plus', 'AMG Line Executive',
    'Night Edition', 'A160', 'A180', 'A200', 'A250', 'A180d', 'A200d', 'A220d', 'A250e', 'A35 AMG', 'A45 AMG',
  ],
  'Mercedes-Benz|B-Class': [
    'SE', 'Sport', 'Sport Executive', 'AMG Line', 'AMG Line Premium', 'B180', 'B200', 'B200d', 'B250e',
  ],
  'Mercedes-Benz|C-Class': [
    'C 180 SE', 'C 200 Sport', 'C 200 AMG Line', 'C 220d AMG Line', 'C 300 AMG Line', 'C 300e AMG Line',
    'C 300de AMG Line', 'C 43 AMG', 'Classic', 'Classic SE', 'Elegance', 'Avantgarde', 'SE', 'Sport', 'Sport Edition',
    'Executive SE', 'AMG Line', 'AMG Line Premium', 'AMG Line Premium Plus', 'AMG Line Night Edition', 'C200',
    'C220d', 'C250d', 'C300', 'C300d', 'C300e', 'C350e', 'C43 AMG', 'C63 AMG',
  ],
  'Mercedes-Benz|CLA': [
    'Sport', 'AMG Line', 'AMG Line Premium', 'AMG Line Premium Plus', 'CLA 180', 'CLA 200', 'CLA 220d', 'CLA 250',
    'CLA 250e', 'CLA 35 AMG', 'CLA 45 AMG',
  ],
  'Mercedes-Benz|CLS': ['AMG Line', 'AMG Line Premium', 'CLS 220d', 'CLS 350d', 'CLS 400d', 'CLS 450', 'CLS 53 AMG'],
  'Mercedes-Benz|E-Class': [
    'E 200 SE', 'E 200 AMG Line', 'E 220d SE', 'E 220d AMG Line', 'E 300 AMG Line', 'E 300de AMG Line',
    'E 400d AMG Line', 'E 53 AMG', 'Classic', 'Elegance', 'Avantgarde', 'SE', 'Sport', 'AMG Line', 'AMG Line Premium',
    'AMG Line Premium Plus', 'AMG Line Night Edition', 'E200', 'E220d', 'E300e', 'E300de', 'E350d', 'E400d',
    'E53 AMG', 'E63 AMG',
  ],
  'Mercedes-Benz|EQA': [
    'AMG Line', 'AMG Line Premium', 'AMG Line Premium Plus', 'EQA 250', 'EQA 250+', 'EQA 300 4MATIC',
    'EQA 350 4MATIC',
  ],
  'Mercedes-Benz|EQC': ['AMG Line', 'AMG Line Premium', 'AMG Line Premium Plus', 'EQC 400 4MATIC'],
  'Mercedes-Benz|GLA': [
    'SE', 'Sport', 'AMG Line', 'AMG Line Premium', 'AMG Line Premium Plus', 'AMG Line Executive', 'Urban Edition',
    'GLA 180', 'GLA 200', 'GLA 220d', 'GLA 250e', 'GLA 35 AMG', 'GLA 45 AMG',
  ],
  'Mercedes-Benz|GLB': [
    'Sport', 'AMG Line', 'AMG Line Premium', 'AMG Line Premium Plus', 'GLB 200', 'GLB 200d', 'GLB 220d 4MATIC',
    'GLB 35 AMG',
  ],
  'Mercedes-Benz|GLC': [
    'GLC 200 AMG Line', 'GLC 220d AMG Line', 'GLC 300 AMG Line', 'GLC 300e AMG Line', 'GLC 300de AMG Line',
    'GLC 43 AMG', 'Sport', 'AMG Line', 'AMG Line Premium', 'AMG Line Premium Plus', 'Urban Edition', 'GLC 220d',
    'GLC 250d', 'GLC 300', 'GLC 300e', 'GLC 300de', 'GLC 350d', 'GLC 63 AMG',
  ],
  'Mercedes-Benz|GLE': [
    'GLE 300d AMG Line', 'GLE 350de AMG Line', 'GLE 400d AMG Line', 'GLE 450 AMG Line', 'GLE 53 AMG', 'AMG Line',
    'AMG Line Premium', 'AMG Line Premium Plus', 'Night Edition', 'GLE 300d', 'GLE 350de', 'GLE 400d', 'GLE 450',
    'GLE 63 S AMG',
  ],
  'Mercedes-Benz|M-Class': [
    'SE', 'Sport', 'AMG Sport', 'ML270 CDI', 'ML320 CDI', 'ML350', 'ML250 BlueTEC', 'ML350 BlueTEC',
  ],
  'Mercedes-Benz|S-Class': [
    'S 350d AMG Line', 'S 400d AMG Line', 'S 450 AMG Line', 'S 580 AMG Line', 'S 63 AMG', 'Maybach S 480',
    'Maybach S 580', 'Maybach S 680',
  ],
  'Mercedes-Benz|V-Class': ['SE', 'Sport', 'AMG Line', 'Exclusive', 'Marco Polo', 'V220d', 'V250d', 'V300d'],

  // ── MG ────────────────────────────────────────────────────────────
  'MG|3': ['Explore', 'Excite', 'Exclusive', 'Form', 'Style', 'VTi-TECH Exclusive', 'Hybrid+ SE', 'Hybrid+ Trophy'],
  'MG|Cyberster': ['Trophy', 'GT'],
  'MG|HS': ['1.5T Explore', '1.5T Exclusive', '1.5T Trophy', 'SE', 'Excite', 'Exclusive', 'Trophy'],
  'MG|MG4': ['Standard', 'SE', 'SE Long Range', 'Trophy', 'Trophy Long Range', 'Trophy Extended Range EV'],
  'MG|MG5 EV': ['SE', 'Exclusive', 'Long Range SE', 'Long Range Trophy'],
  'MG|ZS': [
    '1.5 VTi-TECH Explore', '1.5 VTi-TECH Exclusive', '1.0T GDi Exclusive', 'SE', 'Excite', 'Exclusive', 'Trophy',
  ],
  'MG|ZS EV': ['Long Range SE', 'Long Range Trophy', 'Standard SE'],

  // ── MINI ──────────────────────────────────────────────────────────
  'MINI|Clubman': [
    'One', 'Cooper', 'Cooper S', 'Cooper D', 'Cooper SD', 'John Cooper Works', 'Classic', 'Sport', 'Exclusive',
  ],
  'MINI|Convertible': [
    '1.5 Cooper', '2.0 Cooper S', '2.0 John Cooper Works', 'One', 'Cooper', 'Cooper S', 'Cooper D', 'Cooper SD',
    'John Cooper Works', 'Classic', 'Sport', 'Exclusive',
  ],
  'MINI|Countryman': [
    '1.5 Cooper', '2.0 Cooper S', '2.0 Cooper S ALL4', '1.5 Cooper E', '2.0 Cooper S E ALL4', '2.0 John Cooper Works',
    'One', 'Cooper', 'Cooper S', 'Cooper D', 'Cooper SD', 'Cooper S E ALL4', 'ALL4', 'John Cooper Works', 'Classic',
    'Sport', 'Exclusive',
  ],
  'MINI|Hatch': [
    '1.5 Cooper', '2.0 Cooper S', '2.0 John Cooper Works', '1.5 Cooper Classic', '2.0 Cooper S Exclusive',
    'Electric Cooper SE', 'One', 'Cooper', 'Cooper S', 'Cooper D', 'Cooper SD', 'Cooper SE', 'Electric',
    'John Cooper Works', 'Classic', 'Sport', 'Exclusive',
  ],

  // ── Mitsubishi ────────────────────────────────────────────────────
  'Mitsubishi|ASX': [
    '2.0 GX2h', '2.0 GX3h', '2.0 4WD Dynamic', '2', '3', '4', '5', 'ZC-M', 'ZC-H', 'Dynamic', 'Exceed',
  ],
  'Mitsubishi|Eclipse Cross': [
    '1.5T Juro', '1.5T Verve', '2.4h PHEV Dynamic', '2.4h PHEV Exceed', '2', '3', '4', 'Dynamic', 'Exceed',
    'First Edition',
  ],
  'Mitsubishi|L200': ['4Life', 'Titan', 'Warrior', 'Barbarian', 'Barbarian SVP', 'Barbarian X', 'Animal', 'Trojan'],
  'Mitsubishi|Outlander': [
    '2.4h PHEV Verve', '2.4h PHEV Dynamic', '2.4h PHEV Exceed', '2.0 GX3h', '2.0 GX4hs', 'GX2', 'GX3', 'GX4', 'GX3h',
    'GX4h', 'GX4hs', 'GX5h', '4h', '4hs', '5h', 'Juro', 'Design', 'Exceed', 'Commercial',
  ],
  'Mitsubishi|Shogun': ['Equippe', 'Elegance', 'Warrior', 'SG2', 'SG3', 'SG4', 'SG5', 'Commercial'],

  // ── Nissan ────────────────────────────────────────────────────────
  'Nissan|Ariya': ['Advance', 'Engage', 'Engage+', 'Evolve', 'Evolve+', 'Performance', 'e-4ORCE'],
  'Nissan|Juke': [
    '1.0 DIG-T Visia', '1.0 DIG-T Acenta', '1.0 DIG-T N-Connecta', '1.0 DIG-T Tekna', '1.0 DIG-T N-Sport',
    '1.6 Hybrid N-Connecta', '1.6 Hybrid Tekna', 'Visia', 'Acenta', 'Acenta Premium', 'N-Connecta', 'N-Tec',
    'N-Design', 'Tekna', 'Tekna+', 'Enigma', 'Bose Personal Edition', 'Nismo', 'Nismo RS',
  ],
  'Nissan|Leaf': [
    'Acenta', 'N-Connecta', 'Tekna', 'e+', 'e+ Tekna', 'Visia', 'e+ N-Connecta', 'Shiro', '2.Zero Edition',
  ],
  'Nissan|Micra': [
    'S', 'SE', 'Spirita', 'Sport', '160SR', 'Visia', 'Acenta', 'Tekna', 'N-Tec', 'N-Connecta', 'N-Sport',
    'Bose Personal Edition',
  ],
  'Nissan|Navara': [
    'Visia', 'Acenta', 'Acenta+', 'N-Connecta', 'Tekna', 'N-Guard', 'Outlaw', 'Aventura', 'Trek-1°',
    'Off-Roader AT32',
  ],
  'Nissan|Note': ['Visia', 'Acenta', 'Acenta Premium', 'n-tec', 'Tekna', 'Black Edition', 'N-Connecta'],
  'Nissan|Pulsar': ['Visia', 'Acenta', 'N-Connecta', 'N-Tec', 'Tekna', 'Black Edition'],
  'Nissan|Qashqai': [
    '1.3 DIG-T Acenta', '1.3 DIG-T N-Connecta', '1.3 DIG-T Tekna', '1.3 DIG-T N-Sport', 'e-Power Acenta',
    'e-Power N-Connecta', 'e-Power Tekna', 'e-Power Tekna+', 'Visia', 'Acenta', 'Acenta Premium', 'N-Connecta',
    'N-Tec', 'N-Design', 'Tekna', 'Tekna+', '360', 'Black Edition',
  ],
  'Nissan|X-Trail': [
    '1.5 e-Power Acenta', '1.5 e-Power N-Connecta', '1.5 e-Power Tekna', '1.5 e-Power e-4orce N-Connecta',
    '1.5 e-Power e-4orce Tekna', 'SE', 'Sport', 'SVE', 'Aventura', 'Visia', 'Acenta', 'Acenta Premium', 'N-Connecta',
    'N-Tec', 'Tekna', 'Tekna+',
  ],

  // ── Peugeot ───────────────────────────────────────────────────────
  'Peugeot|107': ['Urban', 'Urban Move', 'Active', 'Allure', 'Envy', 'Sportium', 'Verve'],
  'Peugeot|108': ['Access', 'Active', 'Allure', 'Collection', 'Feline', 'Top!'],
  'Peugeot|207': ['S', 'SE', 'Sport', 'Active', 'Allure', 'Envy', 'Verve', 'Urban', 'GT', 'GTi'],
  'Peugeot|208': [
    '1.2 PureTech 75 Like', '1.2 PureTech 100 Allure', '1.2 PureTech 130 GT', 'e-208 Like', 'e-208 Allure',
    'e-208 GT', 'Access', 'Active', 'Allure', 'Allure Premium', 'Signature', 'Style', 'Feline', 'Tech Edition',
    'GT Line', 'GT', 'GTi',
  ],
  'Peugeot|308': [
    '1.2 PureTech 110 Active', '1.2 PureTech 130 Allure', '1.5 BlueHDi 130 Allure', '1.6 Hybrid 180 GT', 'e-308 GT',
    'Access', 'Active', 'Allure', 'Allure Premium', 'Feline', 'Sport', 'Tech Edition', 'GT Line', 'GT', 'GT Premium',
    'GTi',
  ],
  'Peugeot|508': ['SR', 'Sport', 'Active', 'Allure', 'GT Line', 'GT', 'PSE'],
  'Peugeot|2008': [
    '1.2 PureTech 100 Active', '1.2 PureTech 130 Allure', '1.2 PureTech 155 GT', 'e-2008 Active', 'e-2008 Allure',
    'e-2008 GT', 'Access', 'Active', 'Allure', 'Allure Premium', 'Signature', 'Feline', 'Style', 'GT Line', 'GT',
    'GT Premium',
  ],
  'Peugeot|3008': [
    '1.2 PureTech 130 Active', '1.6 Hybrid 225 GT', '1.6 Hybrid 300 GT 4x4', 'e-3008 Long Range', 'e-3008 GT Premium',
    'Active', 'Allure', 'Allure Premium', 'Sport', 'Exclusive', 'GT Line', 'GT Line Premium', 'GT', 'GT Premium',
    'Hybrid4',
  ],
  'Peugeot|5008': ['Active', 'Allure', 'Allure Premium', 'GT Line', 'GT Line Premium', 'GT', 'GT Premium'],
  'Peugeot|Partner': ['S', 'SE', 'Professional', 'Asphalt', 'Grip'],

  // ── Polestar ──────────────────────────────────────────────────────
  'Polestar|Polestar 2': [
    'Standard Range Single Motor', 'Long Range Single Motor', 'Long Range Dual Motor', 'Plus Pack', 'Pilot Pack',
    'Performance Pack',
  ],

  // ── Porsche ───────────────────────────────────────────────────────
  'Porsche|Cayenne': [
    '3.0 V6 S', '2.9 Bi-Turbo S', '3.0 e-Hybrid', '4.0 V8 Turbo', '4.0 V8 Turbo S', '4.0 V8 Turbo S E-Hybrid',
  ],
  'Porsche|Macan': ['2.0T', '3.0 S', '3.0 GTS', '2.9 Bi-Turbo Turbo', 'Electric', 'Electric S', 'Electric Turbo'],
  'Porsche|Taycan': ['RWD 79kWh', 'RWD 105kWh', '4S', 'GTS', 'Turbo', 'Turbo S'],

  // ── Renault ───────────────────────────────────────────────────────
  'Renault|Arkana': ['Iconic', 'S Edition', 'R.S. Line', 'Techno', 'Esprit Alpine', 'Evolution'],
  'Renault|Austral': ['1.2 E-Tech 130 Evolution', '1.2 E-Tech 200 Techno', '1.2 E-Tech 200 RS Line'],
  'Renault|Captur': [
    '1.0 TCe 90 Evolution', '1.3 TCe 130 Techno', '1.3 TCe 155 RS Line', '1.6 E-Tech 145 Evolution',
    '1.6 E-Tech 145 Techno', '1.6 E-Tech PHEV 160 RS Line', 'Expression+', 'Dynamique', 'Dynamique Nav',
    'Dynamique S Nav', 'Signature', 'Signature X Nav', 'Iconic', 'S Edition', 'Play', 'GT Line', 'RS Line', 'Techno',
    'Evolution', 'Esprit Alpine',
  ],
  'Renault|Clio': [
    '1.0 TCe 65 Evolution', '1.0 TCe 90 Evolution', '1.0 TCe 90 Techno', '1.6 E-Tech 140 Evolution',
    '1.6 E-Tech 140 Techno', '1.3 TCe 130 RS Line', '1.5 dCi 85 Evolution', 'Expression', 'Dynamique', 'Dynamique S',
    'Dynamique MediaNav', 'Dynamique S Nav', 'GT Line', 'Iconic', 'Play', 'Signature', 'Signature X', 'S Edition',
    'RS Line', 'Techno', 'Evolution', 'Esprit Alpine', 'Williams', 'Renaultsport 182', 'Renaultsport 197',
    'Renaultsport 200', 'Renaultsport 220 Trophy',
  ],
  'Renault|Kadjar': [
    'Expression+', 'Dynamique Nav', 'Dynamique S Nav', 'Signature Nav', 'Signature S Nav', 'Iconic', 'Play',
    'GT Line', 'S Edition',
  ],
  'Renault|Megane': [
    '1.3 TCe 115 Iconic', '1.3 TCe 140 Iconic', '1.3 TCe 160 RS Line', '1.5 dCi 115 Iconic', '2.0T 300 RS Trophy',
    'Expression', 'Dynamique', 'Dynamique TomTom', 'GT Line', 'GT', 'Iconic', 'Play', 'Signature', 'S Edition',
    'RS Line', 'Techno', 'Evolution', 'Equilibre', 'Renaultsport 250', 'Renaultsport 265', 'Renaultsport 275 Trophy',
    'RS 280', 'RS 300 Trophy',
  ],
  'Renault|Scenic': [
    'Expression', 'Dynamique', 'Dynamique Nav', 'Dynamique TomTom', 'Signature', 'Bose Edition', 'Iconic', 'Techno',
    'Esprit Alpine',
  ],
  'Renault|Twingo': ['Expression', 'Dynamique', 'Play', 'Iconic', 'GT', 'Urban Night', 'Renaultsport 133'],
  'Renault|Zoe': [
    'R110 Play', 'R110 Iconic', 'R135 Iconic', 'R135 GT Line', 'R135 GT Line+', 'Expression', 'Expression Nav',
    'Dynamique Nav', 'Dynamique Intens', 'Signature Nav', 'Iconic', 'GT Line', 'Play', 'R110', 'R135',
  ],

  // ── SEAT ──────────────────────────────────────────────────────────
  'SEAT|Alhambra': ['S', 'SE', 'SE Lux', 'FR', 'Xcellence'],
  'SEAT|Arona': ['SE', 'SE Technology', 'FR', 'FR Sport', 'Xcellence', 'Xcellence Lux', 'Xperience'],
  'SEAT|Ateca': ['1.0 TSI SE', '1.5 TSI FR', '2.0 TDI SE', '2.0 TDI FR', '1.5 TSI EVO FR Sport'],
  'SEAT|Ibiza': [
    '1.0 MPI SE', '1.0 TSI SE', '1.0 TSI FR', '1.0 TSI Xcellence', '1.5 TSI EVO FR Sport', 'S', 'SE', 'SE Technology',
    'SE Design', 'Toca', 'Chill', 'Sport', 'FR', 'FR Sport', 'Xcellence', 'Xcellence Lux', 'Cupra',
  ],
  'SEAT|Leon': [
    '1.0 TSI SE', '1.5 TSI SE Dynamic', '1.5 TSI FR', '2.0 TSI Cupra', '1.5 TGI FR', '1.0 eTSI FR', 'e-Hybrid FR',
    'e-Hybrid Xcellence', 'S', 'SE', 'SE Dynamic', 'SE Technology', 'FR', 'FR Technology', 'FR Sport', 'Xcellence',
    'Xcellence Lux', 'X-Perience', 'Cupra', 'Cupra R',
  ],
  'SEAT|Mii': ['S', 'SE', 'Design Mii', 'FR-Line', 'Mii by Mango'],
  'SEAT|Tarraco': ['SE', 'SE Technology', 'Xcellence', 'Xcellence Lux', 'FR', 'FR Sport'],

  // ── Skoda ─────────────────────────────────────────────────────────
  'Skoda|Citigo': ['S', 'SE', 'SE L', 'Colour Edition', 'Monte Carlo'],
  'Skoda|Enyaq': ['60', '80', '80x', '85', '85x', 'Founders Edition', 'Sportline', 'Edition', 'vRS'],
  'Skoda|Fabia': [
    '1.0 MPI SE', '1.0 TSI SE Comfort', '1.0 TSI Monte Carlo', '1.5 TSI DSG Monte Carlo', 'Classic', 'Comfort',
    'Elegance', 'Ambiente', 'S', 'SE', 'SE L', 'SE Comfort', 'SE Drive', 'Colour Edition', 'Monte Carlo', 'Scout',
    'vRS',
  ],
  'Skoda|Kamiq': ['S', 'SE', 'SE Drive', 'SE L', 'Edition', 'Monte Carlo'],
  'Skoda|Karoq': [
    '1.0 TSI SE', '1.5 TSI SE L', '1.5 TSI DSG SE L', '2.0 TDI SE L', '2.0 TDI 4x4 Sportline', 'SE', 'SE Drive',
    'SE L', 'SE Technology', 'Edition', 'Scout', 'Sportline',
  ],
  'Skoda|Kodiaq': [
    '1.5 TSI SE', '2.0 TDI SE L', '2.0 TDI 4x4 Sportline', '2.0 TDI 4x4 Laurin & Klement', 'RS', 'S', 'SE',
    'SE Drive', 'SE L', 'SE Technology', 'Edition', 'Scout', 'Sportline', 'Laurin & Klement', 'vRS',
  ],
  'Skoda|Octavia': [
    '1.0 TSI SE', '1.5 TSI SE L', '1.5 TSI DSG SE L', '2.0 TSI Sportline', '2.0 TDI SE L', '2.0 TDI DSG SE L', 'vRS',
    '1.4 TSI iV SE L', 'Classic', 'Ambiente', 'Elegance', 'S', 'SE', 'SE L', 'SE Drive', 'SE Technology',
    'SE First Edition', 'First Edition', 'Edition', 'Laurin & Klement', 'Scout', 'Sportline',
  ],
  'Skoda|Scala': ['S', 'SE', 'SE Technology', 'SE L', 'Edition', 'Monte Carlo'],
  'Skoda|Superb': [
    '1.5 TSI SE', '2.0 TDI SE L', '2.0 TDI DSG Sportline', '2.0 TDI DSG Laurin & Klement', '1.4 TSI iV SE', 'Comfort',
    'Elegance', 'S', 'SE', 'SE Business', 'SE L', 'SE L Executive', 'SE Technology', 'Laurin & Klement', 'Sportline',
    'Sportline Plus',
  ],
  'Skoda|Yeti': ['S', 'SE', 'SE L', 'Elegance', 'Experience', 'Greenline', 'Outdoor', 'Monte Carlo'],

  // ── Smart ─────────────────────────────────────────────────────────
  'Smart|#1': ['Pro', 'Pro+', 'Premium', 'Brabus', 'Launch Edition'],
  'Smart|#3': ['Pro', 'Pro+', 'Premium', 'Brabus'],
  'Smart|Forfour': ['Pure', 'Pulse', 'Passion', 'Prime', 'Proxy', 'Brabus'],
  'Smart|Fortwo': ['Pure', 'Pulse', 'Passion', 'Prime', 'Proxy', 'Brabus', 'EQ'],

  // ── Subaru ────────────────────────────────────────────────────────
  'Subaru|Forester': ['2.0 e-Boxer SE Premium', '2.0 e-Boxer XE Premium', '2.0 e-Boxer X'],
  'Subaru|Impreza': ['2.0i SE', '2.0i Premium', '2.5 WRX STI'],
  'Subaru|Outback': ['2.5i SE', '2.5i CVT SE Premium', '2.5i Executive', '2.5i Executive Premium'],
  'Subaru|WRX': ['WRX Sport CVT', 'WRX Premium', 'WRX tS'],

  // ── Suzuki ────────────────────────────────────────────────────────
  'Suzuki|Alto': ['SZ', 'SZ3', 'SZ4'],
  'Suzuki|Baleno': ['SZ-T', 'SZ5'],
  'Suzuki|Celerio': ['SZ2', 'SZ3', 'SZ4'],
  'Suzuki|Ignis': ['SZ3', 'SZ-T', 'SZ5'],
  'Suzuki|Jimny': ['JLX', 'JLX+', 'SZ3', 'SZ4', 'SZ5'],
  'Suzuki|S-Cross': ['SZ4', 'SZ-T', 'SZ5', 'Motion', 'Ultra'],
  'Suzuki|Splash': ['SZ2', 'SZ3', 'SZ4', 'SZ-L'],
  'Suzuki|Swift': ['GL', 'GLX', 'SZ-L', 'SZ-T', 'SZ2', 'SZ3', 'SZ4', 'SZ5', 'Attitude', 'Sport'],
  'Suzuki|Vitara': ['S', 'SZ4', 'SZ-T', 'SZ5', 'Motion', 'Ultra'],

  // ── Tesla ─────────────────────────────────────────────────────────
  'Tesla|Model 3': [
    'Standard Range Plus', 'Long Range', 'Long Range AWD', 'Performance', 'Rear-Wheel Drive', 'Highland',
  ],
  'Tesla|Model S': ['Long Range', 'Long Range AWD', 'Plaid', 'Plaid+'],
  'Tesla|Model X': ['Long Range', 'Long Range AWD', 'Plaid'],
  'Tesla|Model Y': ['Standard Range', 'Long Range', 'Long Range AWD', 'Performance', 'Rear-Wheel Drive'],

  // ── Toyota ────────────────────────────────────────────────────────
  'Toyota|Auris': [
    'T2', 'T3', 'T4', 'T Spirit', 'T Sport', 'TR', 'SR', 'Icon', 'Icon+', 'Design', 'Excel', 'Business Edition',
    'Hybrid',
  ],
  'Toyota|Avensis': ['T2', 'T3-S', 'T4', 'T Spirit', 'T180', 'TR', 'Active', 'Icon', 'Business Edition', 'Excel'],
  'Toyota|Aygo': [
    '1.0 VVT-i x', '1.0 VVT-i x-play', '1.0 VVT-i x-clusiv', '1.0 VVT-i x-trend', 'Aygo', 'Plus', 'Platinum', 'Ice',
    'Fire', 'Go', 'Move', 'x-pression', 'x-cite', 'x-press',
  ],
  'Toyota|Aygo X': ['1.0 VVT-i Pure', '1.0 VVT-i Edge', '1.0 VVT-i GR Sport', '1.0 VVT-i Limited Edition'],
  'Toyota|bZ4X': ['Pure', 'Pure Pro', 'Vision', 'Dynamic', 'Premium', '2WD', 'AWD'],
  'Toyota|C-HR': [
    '1.8 Hybrid Icon', '1.8 Hybrid Design', '1.8 Hybrid Excel', '2.0 Hybrid GR Sport', '2.0 Plug-in Hybrid Excel',
    '2.0 Plug-in Hybrid GR Sport', 'Icon', 'Design', 'Excel', 'Dynamic', 'GR Sport',
  ],
  'Toyota|Camry': ['2.5 Hybrid Excel', '2.5 Hybrid Design', '2.5 Hybrid Icon'],
  'Toyota|Corolla': [
    '1.2T Icon', '1.2T Design', '1.8 Hybrid Icon', '1.8 Hybrid Design', '1.8 Hybrid Excel', '2.0 Hybrid Excel',
    '2.0 Hybrid GR Sport', '1.8 Hybrid Touring Sports', '2.0 Hybrid Touring Sports GR Sport', 'Icon', 'Icon Tech',
    'Design', 'Excel', 'GR Sport', 'Trek',
  ],
  'Toyota|Corolla Touring Sports': [
    '1.8 Hybrid Icon', '1.8 Hybrid Design', '1.8 Hybrid Excel', '2.0 Hybrid Excel', '2.0 Hybrid GR Sport',
  ],
  'Toyota|GR Supra': ['2.0T GR Supra', '3.0T GR Supra', '3.0T GR Supra Premium', '3.0T GR Supra A90 Edition'],
  'Toyota|GR Yaris': ['1.6T GR Yaris', '1.6T GR Yaris Rally', '1.6T GR Yaris Rallye'],
  'Toyota|GR86': ['2.4 GR86', '2.4 GR86 Premium'],
  'Toyota|Hilux': [
    '2.4D Active', '2.8D Active', '2.8D Icon', '2.8D Invincible', '2.8D Invincible X', 'Ranger', 'Rogue',
  ],
  'Toyota|Land Cruiser': [
    '2.8D Active', '3.0D Active', '3.5 V6 Invincible', '3.5 V6 Invincible X', '2.8D GX', 'Executive', 'LC3', 'LC4',
    'LC5', 'Active', 'Icon', 'Invincible', 'Utility', 'Commercial',
  ],
  'Toyota|Prius': [
    '1.8 VVT-h Active', '1.8 VVT-h Business Edition', '1.8 VVT-h Excel', '2.0 Plug-in Hybrid Excel',
    '2.0 Plug-in Hybrid GR Sport',
  ],
  'Toyota|Proace': ['Active', 'Comfort', 'Design', 'Icon'],
  'Toyota|RAV4': [
    '2.0 VVT-i Active', '2.0 Icon', '2.5 Hybrid Icon', '2.5 Hybrid Design', '2.5 Hybrid Excel',
    '2.5 Hybrid Dynamic Force', '2.5 Plug-in Hybrid Excel', '2.5 Plug-in Hybrid Dynamic Force', 'Adventure',
    'GR Sport', 'XT-R', 'T Spirit', 'Icon', 'Business Edition', 'Design', 'Excel', 'Dynamic',
  ],
  'Toyota|Verso': ['TR', 'T Spirit', 'Active', 'Icon', 'Design', 'Excel'],
  'Toyota|Yaris': [
    '1.0 VVT-i Icon', '1.5 Hybrid Icon', '1.5 Hybrid Design', '1.5 Hybrid Excel', '1.5 Hybrid GR Sport', 'GR Sport',
    'T2', 'T3', 'T Spirit', 'T Sport', 'TR', 'SR', 'Active', 'Icon', 'Icon Tech', 'Design', 'Excel', 'Dynamic',
    'Premiere Edition',
  ],
  'Toyota|Yaris Cross': [
    '1.5 Hybrid Icon', '1.5 Hybrid Design', '1.5 Hybrid Excel', '1.5 Hybrid GR Sport', '1.5 Hybrid Adventure',
    'AWD-i',
  ],

  // ── Vauxhall ──────────────────────────────────────────────────────
  'Vauxhall|Adam': ['Jam', 'Glam', 'Slam', 'Rocks', 'Energised', 'Griffin', 'S'],
  'Vauxhall|Astra': [
    '1.2T Design', '1.2T GS', '1.2T Ultimate', '1.5 Turbo D Design', '1.5 Turbo D GS', '1.6 Plug-in Hybrid GS',
    '1.6 Plug-in Hybrid Ultimate', 'Merit', 'LS', 'Club', 'Life', 'Design', 'Active', 'Energy', 'Exclusiv', 'Excite',
    'Tech Line', 'Tech Line Nav', 'SXi', 'SRi', 'SRi VX-Line', 'SE', 'Elite', 'Elite Nav', 'Griffin', 'Sport',
    'GS Line', 'GS', 'Ultimate', 'VXR',
  ],
  'Vauxhall|Corsa': [
    '1.2 SE', '1.2 SE Premium', '1.2T SRi', '1.2T GS', '1.2T Ultimate', 'Electric SE', 'Electric GS',
    'Electric Ultimate', 'Merit', 'Envoy', 'Club', 'Life', 'Design', 'Active', 'Breeze', 'Energy', 'Excite',
    'Limited Edition', 'SXi', 'SRi', 'SE', 'Sting', 'Griffin', 'Elite', 'Elite Nav', 'GS Line', 'GS', 'Ultimate',
    'Yes', 'VXR',
  ],
  'Vauxhall|Crossland': ['SE', 'Design', 'SRi', 'Elite', 'Griffin', 'GS Line', 'Ultimate'],
  'Vauxhall|Crossland X': ['SE', 'Tech Line Nav', 'Sport', 'Elite', 'Elite Nav', 'Griffin', 'Ultimate'],
  'Vauxhall|Grandland': [
    '1.2T Design', '1.2T GS', '1.5 Turbo D GS', '1.6 Plug-in Hybrid GS', '1.6 Plug-in Hybrid Ultimate', 'Electric GS',
    'Electric Ultimate', 'Design', 'SE', 'Tech Line Nav', 'Sport Nav', 'SRi', 'Business Edition', 'Elite',
    'Elite Nav', 'Griffin', 'GS Line', 'GS', 'Ultimate',
  ],
  'Vauxhall|Grandland X': [
    'SE', 'Tech Line Nav', 'Sport Nav', 'Business Edition Nav', 'Elite', 'Elite Nav', 'Griffin', 'Ultimate',
  ],
  'Vauxhall|Insignia': [
    'Exclusiv', 'Design', 'Tech Line', 'Tech Line Nav', 'SE', 'SE Nav', 'SRi', 'SRi Nav', 'SRi VX-Line', 'Elite',
    'Elite Nav', 'Business Edition', 'Ultimate', 'GSi', 'VXR',
  ],
  'Vauxhall|Meriva': ['Life', 'Club', 'Design', 'Active', 'Exclusiv', 'Energy', 'Tech Line', 'SE'],
  'Vauxhall|Mokka': [
    '1.2T SE', '1.2T GS', '1.2T Ultimate', 'Electric SE', 'Electric GS', 'Electric Ultimate', 'S', 'Exclusiv',
    'Tech Line', 'SE', 'SE Premium', 'Design', 'Active', 'Energy', 'Griffin', 'SRi', 'Elite', 'Elite Nav Premium',
    'GS Line', 'GS', 'Ultimate', 'Yes',
  ],
  'Vauxhall|Mokka X': ['Active', 'Design Nav', 'Elite', 'Elite Nav', 'Griffin', 'SE'],
  'Vauxhall|Viva': ['SE', 'SL', 'Rocks'],
  'Vauxhall|Vivaro': ['Edition', 'Sportive', 'Dynamic', 'Pro', 'Elite', 'Prime'],
  'Vauxhall|Zafira': ['Life', 'Club', 'Design', 'Exclusiv', 'Energy', 'SE', 'SRi', 'Elite', 'Tech Line'],
  'Vauxhall|Zafira Tourer': ['Exclusiv', 'Tech Line', 'Design', 'SE', 'SRi', 'Elite', 'Energy'],

  // ── Volkswagen ────────────────────────────────────────────────────
  'Volkswagen|Amarok': [
    'Startline', 'Trendline', 'Highline', 'Canyon', 'Aventura', 'Black Edition', 'Life', 'Style', 'PanAmericana',
  ],
  'Volkswagen|Arteon': ['Elegance', 'SEL', 'R-Line', 'Black Edition', 'R'],
  'Volkswagen|Beetle': ['Beetle', 'Design', 'Sport', 'Dune', 'R-Line'],
  'Volkswagen|Caddy': ['Startline', 'Trendline', 'Highline', 'Commerce', 'Commerce Plus', 'Life', 'Style'],
  'Volkswagen|Golf': [
    '1.0 TSI Life', '1.5 TSI Life', '1.5 TSI Style', '1.5 TSI R-Line', '2.0 TSI GTI', '2.0 TSI GTI Clubsport',
    '2.0 TSI R', '1.5 TDI Life', '1.5 TDI Style', '1.5 GTE', '1.4 GTE', 'E', 'S', 'SE', 'SE Nav', 'Match',
    'Match Edition', 'GT', 'GT Edge', 'GT Line', 'Bluemotion', 'R-Line', 'R-Line Edition', 'Life', 'Style', 'Active',
    'Edition', 'Black Edition', 'GTI', 'GTI Performance', 'GTI Clubsport', 'GTD', 'GTE', 'R', 'R32',
  ],
  'Volkswagen|ID.3': [
    'Pure Performance', 'Pro Performance', 'Pro S Performance', 'Tour', 'Pure', 'Pro', 'Pro S', 'Life', 'Style',
    'Family', 'Tech', 'Max', '1st Edition', 'Business', 'GTX',
  ],
  'Volkswagen|ID.4': [
    'Pure', 'Pure Performance', 'Pro Performance', 'GTX', 'GTX 4MOTION', 'Pro', 'Life', 'Style', 'Family', 'Tech',
    'Max', 'Match', '1st Edition',
  ],
  'Volkswagen|Passat': [
    '1.5 TSI SE', '1.5 TSI Business', '2.0 TDI SE Business', '2.0 TDI Business', '1.4 GTE', 'S', 'SE', 'SE Business',
    'SE L', 'Sport', 'Highline', 'GT', 'R-Line', 'Elegance', 'Executive', 'Bluemotion', 'Alltrack', 'GTE',
    'GTE Advance',
  ],
  'Volkswagen|Polo': [
    '1.0 MPI Life', '1.0 TSI Life', '1.0 TSI Style', '1.0 TSI R-Line', '2.0 TSI GTI', 'E', 'S', 'SE', 'Match',
    'Match Edition', 'Beats', 'United', 'SEL', 'R-Line', 'Bluemotion', 'Life', 'Style', 'Active', 'GTI', 'GTI+',
  ],
  'Volkswagen|Scirocco': ['Scirocco', 'GT', 'GTS', 'R-Line', 'R'],
  'Volkswagen|Sharan': ['S', 'SE', 'SE Nav', 'SEL', 'Escape'],
  'Volkswagen|T-Cross': ['S', 'SE', 'United', 'SEL', 'R-Line', 'Life', 'Style', 'Match'],
  'Volkswagen|T-Roc': [
    'S', 'SE', 'Design', 'SEL', 'United', 'Life', 'Style', 'Match', 'R-Line', 'Black Edition', 'R',
  ],
  'Volkswagen|Taigo': ['Life', 'Style', 'R-Line', 'Match'],
  'Volkswagen|Tiguan': [
    '1.5 TSI Life', '2.0 TSI R-Line', '2.0 TSI 4Motion R-Line', '2.0 TDI Life', '2.0 TDI R-Line',
    '2.0 TDI 4Motion R-Line', 'R', 'S', 'SE', 'SE Nav', 'SEL', 'Match', 'Match Edition', 'Escape', 'Sport', 'R-Line',
    'R-Line Tech', 'R-Line Edition', 'Life', 'Elegance', 'Active', 'Black Edition',
  ],
  'Volkswagen|Tiguan Allspace': ['Match', 'SEL', 'R-Line', 'R-Line Tech', 'Life', 'Elegance', 'Black Edition'],
  'Volkswagen|Touareg': ['SE', 'SEL', 'Altitude', 'Escape', 'R-Line', 'R-Line Tech', 'Black Edition', 'R'],
  'Volkswagen|Touran': ['S', 'SE', 'SE Family', 'SEL', 'R-Line', 'Highline'],
  'Volkswagen|Transporter': [
    'Startline', 'Trendline', 'Highline', 'Sportline', 'Commerce', 'Commerce Pro', 'Life', 'Style',
  ],
  'Volkswagen|up!': [
    'Take up!', 'Move up!', 'High up!', 'Groove up!', 'Rock up!', 'Cross up!', 'up! Beats', 'up! GTI',
  ],

  // ── Volvo ─────────────────────────────────────────────────────────
  'Volvo|EX30': ['Single Motor Extended Range', 'Twin Motor Performance', 'Single Motor Core', 'Single Motor Plus'],
  'Volvo|S60': [
    'SE', 'SE Lux', 'R-Design', 'Momentum', 'Inscription', 'Polestar Engineered', 'Core', 'Plus', 'Ultimate',
  ],
  'Volvo|S90': ['Momentum', 'R-Design', 'Inscription', 'Core', 'Plus', 'Ultimate'],
  'Volvo|V40': [
    'ES', 'SE', 'SE Lux', 'SE Nav', 'R-Design', 'R-Design Nav', 'R-Design Pro', 'Momentum', 'Inscription',
    'Cross Country',
  ],
  'Volvo|V60': [
    'B3 Momentum', 'B4 R-Design', 'B4 Inscription', 'T8 AWD Recharge', 'Cross Country', 'ES', 'SE', 'SE Lux',
    'R-Design', 'R-Design Pro', 'Momentum', 'Inscription', 'Polestar Engineered', 'Core', 'Plus', 'Ultimate',
  ],
  'Volvo|V90': ['Momentum', 'R-Design', 'Inscription', 'Core', 'Plus', 'Ultimate'],
  'Volvo|XC40': [
    'Momentum', 'Momentum Pro', 'R-Design', 'R-Design Pro', 'Inscription', 'Inscription Pro', 'First Edition', 'Core',
    'Plus', 'Ultimate',
  ],
  'Volvo|XC60': [
    'B4 Momentum', 'B4 R-Design', 'B4 Inscription', 'B5 R-Design', 'T6 AWD R-Design', 'T8 AWD Recharge',
    'T8 AWD Ultimate Dark', 'SE', 'SE Lux', 'R-Design', 'R-Design Pro', 'Momentum', 'Momentum Pro', 'Inscription',
    'Inscription Pro', 'Polestar Engineered', 'Core', 'Plus', 'Ultimate',
  ],
  'Volvo|XC90': [
    'B5 Momentum', 'B5 R-Design', 'B5 Inscription', 'T8 AWD Recharge', 'T8 AWD Ultimate Dark', 'SE', 'SE Lux',
    'Momentum', 'R-Design', 'R-Design Pro', 'Inscription', 'Inscription Pro', 'Excellence', 'Core', 'Plus',
    'Ultimate',
  ],
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
