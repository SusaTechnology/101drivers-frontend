/**
 * Vehicle Make & Model Database
 * Comprehensive US-market vehicle makes and their models for cascading dropdowns.
 */

export interface VehicleModel {
  name: string;
}

export interface VehicleMake {
  name: string;
  models: VehicleModel[];
}

export const vehicleMakes: VehicleMake[] = [
  {
    name: "Acura",
    models: [
      { name: "ILX" }, { name: "Integra" }, { name: "MDX" }, { name: "NSX" },
      { name: "RDX" }, { name: "RLX" }, { name: "TLX" }, { name: "TSX" },
    ],
  },
  {
    name: "Alfa Romeo",
    models: [
      { name: "4C" }, { name: "Giulia" }, { name: "Stelvio" }, { name: "Tonale" },
    ],
  },
  {
    name: "Aston Martin",
    models: [
      { name: "DB11" }, { name: "DB12" }, { name: "DBS" }, { name: "DBX" },
      { name: "Vantage" }, { name: "Valhalla" },
    ],
  },
  {
    name: "Audi",
    models: [
      { name: "A3" }, { name: "A4" }, { name: "A5" }, { name: "A6" }, { name: "A7" }, { name: "A8" },
      { name: "e-tron" }, { name: "e-tron GT" },
      { name: "Q3" }, { name: "Q4 e-tron" }, { name: "Q5" }, { name: "Q7" }, { name: "Q8" },
      { name: "RS3" }, { name: "RS5" }, { name: "RS6" }, { name: "RS7" },
      { name: "R8" },
      { name: "S3" }, { name: "S4" }, { name: "S5" }, { name: "S6" }, { name: "S7" }, { name: "S8" },
      { name: "SQ5" }, { name: "SQ7" }, { name: "SQ8" },
      { name: "TT" },
    ],
  },
  {
    name: "Bentley",
    models: [
      { name: "Bentayga" }, { name: "Continental GT" }, { name: "Flying Spur" },
    ],
  },
  {
    name: "BMW",
    models: [
      { name: "2 Series" }, { name: "3 Series" }, { name: "4 Series" }, { name: "5 Series" },
      { name: "7 Series" }, { name: "8 Series" },
      { name: "i3" }, { name: "i4" }, { name: "i5" }, { name: "i7" }, { name: "iX" }, { name: "iX1" }, { name: "iX2" },
      { name: "M2" }, { name: "M3" }, { name: "M4" }, { name: "M5" }, { name: "M8" },
      { name: "X1" }, { name: "X2" }, { name: "X3" }, { name: "X4" }, { name: "X5" }, { name: "X6" }, { name: "X7" }, { name: "XM" },
      { name: "Z4" },
    ],
  },
  {
    name: "Buick",
    models: [
      { name: "Enclave" }, { name: "Encore" }, { name: "Encore GX" },
      { name: "Envista" }, { name: "LaCrosse" }, { name: "Regal" }, { name: "Verano" },
    ],
  },
  {
    name: "Cadillac",
    models: [
      { name: "CT4" }, { name: "CT5" }, { name: "CTS" },
      { name: "Escalade" }, { name: "Escalade ESV" }, { name: "Escalade IQ" },
      { name: "Lyriq" }, { name: "SRX" },
      { name: "XT4" }, { name: "XT5" }, { name: "XT6" },
    ],
  },
  {
    name: "Chevrolet",
    models: [
      { name: "Blazer" }, { name: "Bolt EUV" }, { name: "Camaro" }, { name: "Colorado" },
      { name: "Corvette" }, { name: "Equinox" }, { name: "Equinox EV" }, { name: "Express" },
      { name: "Impala" }, { name: "Malibu" },
      { name: "Silverado" }, { name: "Silverado EV" },
      { name: "Sonic" }, { name: "Spark" }, { name: "Suburban" }, { name: "Tahoe" },
      { name: "Traverse" }, { name: "Trax" }, { name: "Volt" },
    ],
  },
  {
    name: "Chrysler",
    models: [
      { name: "200" }, { name: "300" }, { name: "300C" },
      { name: "Aspen" }, { name: "Pacifica" }, { name: "Pacifica Hybrid" },
      { name: "PT Cruiser" }, { name: "Sebring" }, { name: "Town & Country" },
    ],
  },
  {
    name: "Dodge",
    models: [
      { name: "Avenger" }, { name: "Caliber" }, { name: "Challenger" }, { name: "Charger" },
      { name: "Charger Daytona" }, { name: "Dart" }, { name: "Durango" }, { name: "Grand Caravan" },
      { name: "Hornet" }, { name: "Intrepid" }, { name: "Journey" }, { name: "Magnum" },
      { name: "Neon" }, { name: "Nitro" }, { name: "Ram 1500" }, { name: "Viper" },
    ],
  },
  {
    name: "Ferrari",
    models: [
      { name: "296 GTB" }, { name: "488 GTB" }, { name: "812 Superfast" },
      { name: "California" }, { name: "Daytona SP3" }, { name: "F40" }, { name: "F430" },
      { name: "F8 Tributo" }, { name: "FF" }, { name: "Portofino" }, { name: "Roma" },
      { name: "SF90 Stradale" },
    ],
  },
  {
    name: "Fiat",
    models: [
      { name: "124 Spider" }, { name: "500" }, { name: "500X" }, { name: "500e" },
      { name: "Panda" }, { name: "Punto" },
    ],
  },
  {
    name: "Ford",
    models: [
      { name: "Bronco" }, { name: "Bronco Sport" }, { name: "C-Max" }, { name: "Contour" },
      { name: "Crown Victoria" }, { name: "EcoSport" }, { name: "Edge" }, { name: "Escape" },
      { name: "Excursion" }, { name: "Expedition" }, { name: "Explorer" },
      { name: "F-150" }, { name: "F-150 Lightning" }, { name: "F-250" }, { name: "F-350" },
      { name: "Fiesta" }, { name: "Flex" }, { name: "Focus" }, { name: "Fusion" },
      { name: "GT" }, { name: "Maverick" },
      { name: "Mustang" }, { name: "Mustang Mach-E" },
      { name: "Ranger" }, { name: "Taurus" }, { name: "Thunderbird" },
      { name: "Transit" }, { name: "Windstar" },
    ],
  },
  {
    name: "Genesis",
    models: [
      { name: "G70" }, { name: "G80" }, { name: "G90" },
      { name: "GV60" }, { name: "GV70" }, { name: "GV80" },
    ],
  },
  {
    name: "GMC",
    models: [
      { name: "Acadia" }, { name: "Canyon" }, { name: "Envoy" }, { name: "Jimmy" },
      { name: "Savana" }, { name: "Sierra" }, { name: "Sierra EV" },
      { name: "Terrain" }, { name: "Yukon" }, { name: "Yukon XL" },
    ],
  },
  {
    name: "Honda",
    models: [
      { name: "Accord" }, { name: "Accord Hybrid" },
      { name: "Civic" }, { name: "Civic Type R" },
      { name: "CR-V" }, { name: "CR-V Hybrid" },
      { name: "CR-Z" }, { name: "Element" }, { name: "Fit" }, { name: "HR-V" },
      { name: "Insight" }, { name: "Odyssey" }, { name: "Passport" }, { name: "Pilot" },
      { name: "Prologue" }, { name: "Ridgeline" }, { name: "S2000" },
    ],
  },
  {
    name: "Hyundai",
    models: [
      { name: "Accent" }, { name: "Azera" },
      { name: "Elantra" }, { name: "Elantra Hybrid" }, { name: "Elantra N" },
      { name: "Equus" },
      { name: "Ioniq 5" }, { name: "Ioniq 6" },
      { name: "Kona" }, { name: "Kona Electric" }, { name: "Kona N" },
      { name: "Palisade" }, { name: "Santa Cruz" },
      { name: "Santa Fe" }, { name: "Santa Fe Hybrid" },
      { name: "Sonata" }, { name: "Sonata Hybrid" },
      { name: "Tucson" }, { name: "Tucson Hybrid" },
      { name: "Veloster" }, { name: "Veracruz" },
    ],
  },
  {
    name: "Infiniti",
    models: [
      { name: "FX35" }, { name: "G35" }, { name: "G37" },
      { name: "Q50" }, { name: "Q55" }, { name: "Q60" },
      { name: "QX50" }, { name: "QX55" }, { name: "QX60" }, { name: "QX80" },
    ],
  },
  {
    name: "Jaguar",
    models: [
      { name: "E-Pace" }, { name: "F-Pace" }, { name: "F-Type" },
      { name: "I-Pace" }, { name: "S-Type" },
      { name: "XE" }, { name: "XF" }, { name: "XJ" }, { name: "XK" },
    ],
  },
  {
    name: "Jeep",
    models: [
      { name: "Cherokee" }, { name: "Compass" }, { name: "Commander" },
      { name: "Gladiator" }, { name: "Grand Cherokee" }, { name: "Grand Cherokee L" },
      { name: "Liberty" }, { name: "Patriot" }, { name: "Renegade" },
      { name: "Wrangler" }, { name: "Wagoneer" }, { name: "Wagoneer L" },
    ],
  },
  {
    name: "Kia",
    models: [
      { name: "Cadenza" }, { name: "Carnival" },
      { name: "EV6" }, { name: "EV9" },
      { name: "Forte" }, { name: "K5" },
      { name: "Niro" }, { name: "Niro EV" },
      { name: "Optima" }, { name: "Rio" }, { name: "Sedona" },
      { name: "Seltos" }, { name: "Sorento" }, { name: "Sorento Hybrid" },
      { name: "Soul" }, { name: "Sportage" }, { name: "Sportage Hybrid" },
      { name: "Stinger" }, { name: "Telluride" },
    ],
  },
  {
    name: "Lamborghini",
    models: [
      { name: "Aventador" }, { name: "Countach" }, { name: "Gallardo" },
      { name: "Huracan" }, { name: "Revuelto" }, { name: "Urus" },
    ],
  },
  {
    name: "Land Rover",
    models: [
      { name: "Defender" }, { name: "Defender 90" }, { name: "Defender 110" },
      { name: "Discovery" }, { name: "Discovery Sport" },
      { name: "Evoque" }, { name: "LR2" }, { name: "LR3" }, { name: "LR4" },
      { name: "Range Rover" }, { name: "Range Rover Evoque" },
      { name: "Range Rover Sport" }, { name: "Range Rover Velar" },
      { name: "Range Rover Autobiography" },
    ],
  },
  {
    name: "Lexus",
    models: [
      { name: "CT" }, { name: "ES" }, { name: "ES Hybrid" },
      { name: "GS" }, { name: "GX" }, { name: "IS" },
      { name: "LC" }, { name: "LS" }, { name: "LX" }, { name: "LX 600" },
      { name: "NX" }, { name: "NX Hybrid" },
      { name: "RC" }, { name: "RC F" },
      { name: "RX" }, { name: "RX Hybrid" },
      { name: "UX" }, { name: "UX Hybrid" },
    ],
  },
  {
    name: "Lincoln",
    models: [
      { name: "Aviator" }, { name: "Continental" }, { name: "Corsair" },
      { name: "MKC" }, { name: "MKZ" }, { name: "Nautilus" },
      { name: "Navigator" }, { name: "Zephyr" },
    ],
  },
  {
    name: "Lotus",
    models: [
      { name: "Emira" }, { name: "Evija" }, { name: "Evora" }, { name: "Exige" },
    ],
  },
  {
    name: "Maserati",
    models: [
      { name: "Ghibli" }, { name: "GranTurismo" }, { name: "Grecale" },
      { name: "Levante" }, { name: "MC20" }, { name: "Quattroporte" },
    ],
  },
  {
    name: "Mazda",
    models: [
      { name: "CX-3" }, { name: "CX-5" }, { name: "CX-30" }, { name: "CX-50" },
      { name: "CX-70" }, { name: "CX-90" },
      { name: "Mazda2" }, { name: "Mazda3" }, { name: "Mazda6" },
      { name: "MX-5 Miata" }, { name: "RX-7" }, { name: "RX-8" }, { name: "Tribute" },
    ],
  },
  {
    name: "McLaren",
    models: [
      { name: "570S" }, { name: "600LT" }, { name: "650S" }, { name: "720S" },
      { name: "765LT" }, { name: "Artura" }, { name: "GT" }, { name: "MP4-12C" }, { name: "P1" },
    ],
  },
  {
    name: "Mercedes-Benz",
    models: [
      { name: "A-Class" }, { name: "AMG GT" }, { name: "B-Class" },
      { name: "C-Class" }, { name: "C43 AMG" }, { name: "C63 AMG" },
      { name: "CLA" }, { name: "CLK" }, { name: "CLS" },
      { name: "E-Class" }, { name: "E53 AMG" }, { name: "E63 AMG" },
      { name: "EQB" }, { name: "EQE" }, { name: "EQE SUV" }, { name: "EQS" }, { name: "EQS SUV" },
      { name: "G-Class" }, { name: "G63 AMG" },
      { name: "GLA" }, { name: "GLB" }, { name: "GLC" }, { name: "GLE" }, { name: "GLS" },
      { name: "Maybach S-Class" }, { name: "Metris" },
      { name: "S-Class" }, { name: "S63 AMG" }, { name: "S65 AMG" },
      { name: "SLC" }, { name: "SLK" }, { name: "SL-Class" }, { name: "SLS AMG" },
      { name: "Sprinter" },
    ],
  },
  {
    name: "Mercury",
    models: [
      { name: "Grand Marquis" }, { name: "Mariner" }, { name: "Milan" },
      { name: "Mountaineer" }, { name: "Sable" }, { name: "Villager" },
    ],
  },
  {
    name: "Mini",
    models: [
      { name: "Clubman" }, { name: "Cooper" }, { name: "Cooper S" },
      { name: "Countryman" }, { name: "Convertible" }, { name: "Hardtop" },
      { name: "JCW" }, { name: "Paceman" },
    ],
  },
  {
    name: "Mitsubishi",
    models: [
      { name: "Eclipse" }, { name: "Eclipse Cross" }, { name: "Endeavor" },
      { name: "Galant" }, { name: "L200" }, { name: "Lancer" }, { name: "Lancer Evolution" },
      { name: "Mirage" }, { name: "Montero" },
      { name: "Outlander" }, { name: "Outlander Sport" }, { name: "Outlander PHEV" },
    ],
  },
  {
    name: "Nissan",
    models: [
      { name: "350Z" }, { name: "370Z" },
      { name: "Altima" }, { name: "Ariya" }, { name: "Armada" },
      { name: "Cube" }, { name: "Frontier" }, { name: "GT-R" },
      { name: "Juke" }, { name: "Kicks" }, { name: "Leaf" },
      { name: "Maxima" }, { name: "Murano" }, { name: "NV" },
      { name: "Pathfinder" }, { name: "Quest" },
      { name: "Rogue" }, { name: "Rogue Sport" }, { name: "Sentra" },
      { name: "Titan" }, { name: "Versa" }, { name: "Xterra" }, { name: "Z" },
    ],
  },
  {
    name: "Porsche",
    models: [
      { name: "718 Boxster" }, { name: "718 Cayman" },
      { name: "911" }, { name: "911 Carrera" }, { name: "911 GT3" }, { name: "911 Turbo" }, { name: "911 Turbo S" },
      { name: "Cayenne" }, { name: "Macan" }, { name: "Panamera" }, { name: "Taycan" },
    ],
  },
  {
    name: "Ram",
    models: [
      { name: "1500" }, { name: "2500" }, { name: "3500" }, { name: "4500" }, { name: "5500" },
      { name: "ProMaster" }, { name: "ProMaster City" },
    ],
  },
  {
    name: "Rivian",
    models: [
      { name: "R1S" }, { name: "R1T" }, { name: "R2" },
    ],
  },
  {
    name: "Rolls-Royce",
    models: [
      { name: "Cullinan" }, { name: "Ghost" }, { name: "Phantom" }, { name: "Spectre" }, { name: "Wraith" },
    ],
  },
  {
    name: "Subaru",
    models: [
      { name: "Ascent" }, { name: "BRZ" }, { name: "Crosstrek" },
      { name: "Forester" }, { name: "Impreza" }, { name: "Legacy" },
      { name: "Outback" }, { name: "Solterra" },
      { name: "WRX" }, { name: "WRX STI" }, { name: "XV" },
    ],
  },
  {
    name: "Tesla",
    models: [
      { name: "Cybertruck" }, { name: "Model 3" }, { name: "Model S" },
      { name: "Model X" }, { name: "Model Y" }, { name: "Roadster" }, { name: "Semi" },
    ],
  },
  {
    name: "Toyota",
    models: [
      { name: "4Runner" }, { name: "86" }, { name: "Avalon" },
      { name: "Camry" }, { name: "Camry Hybrid" }, { name: "Celica" },
      { name: "Corolla" }, { name: "Corolla Cross" }, { name: "Corolla Hatchback" },
      { name: "C-HR" }, { name: "FJ Cruiser" },
      { name: "GR86" }, { name: "GR Supra" },
      { name: "Highlander" }, { name: "Highlander Hybrid" },
      { name: "Land Cruiser" }, { name: "Matrix" }, { name: "Mirai" },
      { name: "Prius" },
      { name: "RAV4" }, { name: "RAV4 Hybrid" }, { name: "RAV4 Prime" },
      { name: "Sequoia" }, { name: "Sienna" }, { name: "Solara" },
      { name: "Supra" }, { name: "Tacoma" }, { name: "Tundra" },
      { name: "Venza" }, { name: "Yaris" },
    ],
  },
  {
    name: "Volkswagen",
    models: [
      { name: "Arteon" }, { name: "Atlas" }, { name: "Beetle" }, { name: "CC" },
      { name: "Eos" }, { name: "Golf" }, { name: "Golf GTI" }, { name: "Golf R" },
      { name: "ID.4" }, { name: "ID.Buzz" }, { name: "Jetta" }, { name: "Passat" },
      { name: "Rabbit" }, { name: "Routan" }, { name: "Taos" },
      { name: "Tiguan" }, { name: "Touareg" },
    ],
  },
  {
    name: "Volvo",
    models: [
      { name: "C30" }, { name: "C40 Recharge" }, { name: "C70" },
      { name: "S40" }, { name: "S60" }, { name: "S90" },
      { name: "V50" }, { name: "V60" }, { name: "V90" },
      { name: "XC40" }, { name: "XC40 Recharge" }, { name: "XC60" }, { name: "XC90" },
    ],
  },
];

/** Get sorted list of all make names */
export function getAllMakes(): string[] {
  return vehicleMakes.map((m) => m.name).sort();
}

/** Get models for a specific make, sorted alphabetically */
export function getModelsForMake(make: string): string[] {
  const found = vehicleMakes.find(
    (m) => m.name.toLowerCase() === make.toLowerCase()
  );
  return found ? found.models.map((m) => m.name).sort() : [];
}

/** Check if a make exists in the database */
export function isValidMake(make: string): boolean {
  return vehicleMakes.some((m) => m.name.toLowerCase() === make.toLowerCase());
}

/** Check if a model exists for a given make */
export function isValidModel(make: string, model: string): boolean {
  const found = vehicleMakes.find(
    (m) => m.name.toLowerCase() === make.toLowerCase()
  );
  return found
    ? found.models.some((m) => m.name.toLowerCase() === model.toLowerCase())
    : false;
}
