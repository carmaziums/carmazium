// Same body-family mapping as src/components/listing/ThreeDVehicleViewer.tsx.
export type DamageModel = "sedan" | "hatchback" | "suv";
export function selectDamageModel(bodyType?: string | null): DamageModel {
  const type = String(bodyType ?? "").trim().toUpperCase().replace(/[ -]/g, "_");
  if (["HATCHBACK","ESTATE","STATION_WAGON","WAGON"].includes(type)) return "hatchback";
  if (["SUV","CROSSOVER","PICKUP_TRUCK","PICKUP","MINIVAN","MPV","VAN"].includes(type)) return "suv";
  return "sedan";
}
