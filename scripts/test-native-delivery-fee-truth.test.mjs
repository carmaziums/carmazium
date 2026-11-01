import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const native = readFileSync(new URL("../carmazium app/carmazium app/src/screens/sell/SellCarFlowScreen.tsx", import.meta.url), "utf8")
test("native seller delivery information does not invent platform delivery rates", () => {
  assert.doesNotMatch(native, /Tiered base|EXAMPLE_MILES|feeExVat|£30.*£70|base fee only/)
  assert.match(native, /CarMazium does not set a fixed delivery fee/)
  assert.match(native, /YOUR DELIVERY PRICE PER MILE/)
  assert.match(native, /deliveryPricePerMile: deliveryPricePerMile \? parseFloat\(deliveryPricePerMile\)/)
  assert.match(native, /deliveryMaxMiles: deliveryMaxMiles \? parseFloat\(deliveryMaxMiles\)/)
})
