import assert from "node:assert/strict";
import {
  isSyntheticScratchGeneratedContent,
  isSyntheticScratchListingBullet,
  resolveGraphicsScratchUploadListingBaseline,
} from "./graphics-scratch-listing-baseline.js";

function run() {
  const view = resolveGraphicsScratchUploadListingBaseline({
    productName: "Body Cream",
    brandName: "Acme",
    category: "Beauty",
    productDescription: "Rich moisturizer for dry skin.",
    bulletPoints: [
      "High-quality body cream designed for everyday use",
      "Custom bullet from seller",
    ],
    productDetails: [{ attribute: "Material", value: "Shea butter" }],
  });
  assert.ok(view);
  assert.equal(view?.title, "Acme Body Cream");
  assert.deepEqual(view?.bulletPoints, ["Custom bullet from seller"]);
  assert.match(view?.htmlDescription ?? "", /Rich moisturizer/);
  assert.equal(view?.attributes?.[0]?.attribute, "Material");

  const identity = { productName: "Body Cream", brandName: "", category: "Beauty" };
  const synthetic = {
    title: "Body Cream",
    bulletPoints: [
      "High-quality body cream designed for everyday use",
      "Perfect for beauty enthusiasts and professionals",
    ],
    keywords: [],
    htmlDescription: "",
  };
  assert.equal(isSyntheticScratchGeneratedContent(synthetic, identity), true);
  assert.equal(
    isSyntheticScratchGeneratedContent(
      { ...synthetic, bulletPoints: ["Seller-written benefit"] },
      identity,
    ),
    false,
  );
  assert.equal(isSyntheticScratchListingBullet("Designed for everyday use"), true);
  assert.equal(isSyntheticScratchListingBullet("Organic aloe formula"), false);
  console.log("graphics-scratch-listing-baseline.test.ts: ok");
}

run();