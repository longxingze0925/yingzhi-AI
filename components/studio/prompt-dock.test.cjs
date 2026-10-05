const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ts = require("typescript");

const root = path.resolve(__dirname, "../..");

function parseSource(relativePath) {
  const filePath = path.join(root, relativePath);
  const source = fs.readFileSync(filePath, "utf8");
  return ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    relativePath.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function findVariableInitializer(sourceFile, name) {
  let initializer;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(sourceFile) === name
    ) {
      initializer = node.initializer;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  assert.ok(initializer, `Expected ${name} initializer in source`);
  return initializer;
}

function findIfCondition(sourceFile, text) {
  let condition;
  function visit(node) {
    if (
      ts.isIfStatement(node) &&
      node.expression.getText(sourceFile).includes(text)
    ) {
      condition = node.expression;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  assert.ok(condition, `Expected if condition containing ${text}`);
  return condition;
}

function findButtonByAriaLabel(sourceFile, label) {
  let button;
  function visit(node) {
    if (
      ts.isJsxOpeningElement(node) &&
      node.tagName.getText(sourceFile) === "button" &&
      node.attributes.properties.some(
        (attribute) =>
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText(sourceFile) === "aria-label" &&
          ts.isStringLiteral(attribute.initializer) &&
          attribute.initializer.text === label,
      )
    ) {
      button = node;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  assert.ok(button, `Expected button with aria-label ${label}`);
  return button;
}

function evaluateExpression(sourceFile, expression, variables) {
  const expressionJs = ts
    .createPrinter()
    .printNode(ts.EmitHint.Expression, expression, sourceFile);
  const declarations = Object.entries(variables)
    .map(([name, value]) => `const ${name} = ${JSON.stringify(value)};`)
    .join("\n");
  return vm.runInNewContext(`${declarations}\n${expressionJs};`);
}

function findFunctionDeclaration(sourceFile, name) {
  let declaration;
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      declaration = node;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  assert.ok(declaration, `Expected ${name} helper`);
  return declaration;
}

function loadEstimateCostForModel(sourceFile) {
  const helperSource = ["billingUnit", "billingUnitCost", "estimateCostForModel"]
    .map((name) => findFunctionDeclaration(sourceFile, name).getFullText(sourceFile))
    .map((source) => source.replace(/export\s+function\s+/, "function "))
    .map((source) =>
      ts.transpile(source, {
        target: ts.ScriptTarget.ES2020,
      }),
    )
    .join("\n");
  return vm.runInNewContext(`${helperSource}; estimateCostForModel`);
}

const promptDock = parseSource("components/studio/prompt-dock.tsx");
const assetPicker = parseSource("components/studio/asset-picker-dialog.tsx");
const apiClient = parseSource("lib/api/client.ts");

test("final cost uses the selected per-second video resolution price", () => {
  const estimateCostForModel = loadEstimateCostForModel(apiClient);
  const capabilities = { defaultDurationSeconds: 8 };
  const model = {
    modality: "video",
    billing: {
      unit: "second",
      unitPriceMinor: 0.274,
      secondResolutionPricesMinor: { "480p": 0.075, "720p": 0.105 },
    },
    capabilities,
  };

  assert.equal(
    estimateCostForModel({
      type: "video",
      count: 1,
      durationSec: 10,
      resolution: "480p",
      model,
    }),
    0.075 * 10,
  );
  assert.equal(
    estimateCostForModel({
      type: "video",
      count: 1,
      durationSec: 10,
      resolution: "720p",
      model,
    }),
    0.105 * 10,
  );
  assert.equal(
    estimateCostForModel({
      type: "video",
      count: 1,
      durationSec: 10,
      resolution: "1080p",
      model,
    }),
    0.274 * 10,
  );
});

test("request billing remains one charge even when a video resolution map exists", () => {
  const estimateCostForModel = loadEstimateCostForModel(apiClient);

  assert.equal(
    estimateCostForModel({
      type: "video",
      count: 3,
      durationSec: 30,
      resolution: "720p",
      model: {
        modality: "video",
        billing: {
          unit: "request",
          unitPriceMinor: 411000,
          secondResolutionPricesMinor: { "720p": 105000 },
        },
        capabilities: { defaultDurationSeconds: 8 },
      },
    }),
    411000,
  );
});

test("request-priced video estimates use the selected resolution price", () => {
  const estimateCostForModel = loadEstimateCostForModel(apiClient);
  const model = {
    modality: "video",
    billing: {
      unit: "request",
      unitPriceMinor: 300000,
      requestPriceMinor: 300000,
      requestResolutionPricesMinor: { "720p": 300000, "1080p": 375000 },
    },
    capabilities: { defaultDurationSeconds: 10 },
  };

  assert.equal(
    estimateCostForModel({
      type: "video",
      count: 1,
      durationSec: 10,
      resolution: "720p",
      model,
    }),
    300000,
  );
  assert.equal(
    estimateCostForModel({
      type: "video",
      count: 1,
      durationSec: 10,
      resolution: "1080p",
      model,
    }),
    375000,
  );
  assert.equal(
    estimateCostForModel({
      type: "video",
      count: 1,
      durationSec: 10,
      resolution: "4k",
      model,
    }),
    300000,
    "unknown resolution keeps the configured base request price",
  );
});

test("image pricing still follows the selected image count", () => {
  const estimateCostForModel = loadEstimateCostForModel(apiClient);

  assert.equal(
    estimateCostForModel({
      type: "image",
      count: 4,
      model: {
        modality: "image",
        billing: { unit: "request", imagePriceMinor: 220000 },
        capabilities: {},
      },
    }),
    220000 * 4,
  );
});

test("image pricing follows the selected resolution tier and image count", () => {
  const estimateCostForModel = loadEstimateCostForModel(apiClient);
  const model = {
    modality: "image",
    billing: {
      unit: "request",
      imagePriceMinor: 20000,
      imageResolutionPricesMinor: { "1K": 20000, "2K": 30000 },
    },
    capabilities: {},
  };

  assert.equal(
    estimateCostForModel({ type: "image", count: 2, resolution: "1K", model }),
    40000,
  );
  assert.equal(
    estimateCostForModel({ type: "image", count: 2, resolution: "2k", model }),
    60000,
  );
});

test("route dropdown shows the configured price with its billing unit", () => {
  const declaration = promptDock.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "routeBillingPriceLabel",
  );
  assert.ok(declaration, "Expected routeBillingPriceLabel helper");
  const helperJs = ts.transpile(declaration.getFullText(promptDock), {
    target: ts.ScriptTarget.ES2020,
  });
  const routeBillingPriceLabel = vm.runInNewContext(
    `const formatStudioQuotaWithSuffix = (price) => price.toFixed(3) + "¥"; ${helperJs}; routeBillingPriceLabel`,
  );

  assert.equal(
    routeBillingPriceLabel(
      { mode: "tiered_expr", unit: "second", unitPriceMinor: 0.274 },
      999,
    ),
    "0.274¥/秒",
  );
  assert.equal(
    routeBillingPriceLabel(
      {
        mode: "tiered_expr",
        unit: "second",
        unitPriceMinor: 0.274,
        secondResolutionPricesMinor: { "480p": 0.075, "720p": 0.105 },
      },
      999,
      "video",
      "720p",
    ),
    "0.105¥/秒",
  );
  assert.equal(
    routeBillingPriceLabel(
      {
        mode: "tiered_expr",
        unit: "request",
        requestPriceMinor: 300000,
        requestResolutionPricesMinor: { "720p": 300000, "1080p": 375000 },
      },
      999,
      "video",
      "1080p",
    ),
    "375000.000¥/条",
  );
  assert.equal(
    routeBillingPriceLabel(
      {
        mode: "tiered_expr",
        unit: "second",
        unitPriceMinor: 0.274,
        secondResolutionPricesMinor: { "480p": 0.075, "720p": 0.105 },
      },
      999,
      "video",
      "1080p",
    ),
    "0.274¥/秒",
  );
  assert.equal(
    routeBillingPriceLabel(
      {
        mode: "ratio",
        unit: "request",
        unitPriceMinor: 0.274,
        secondResolutionPricesMinor: { "720p": 0.105 },
      },
      999,
      "video",
      "720p",
    ),
    "0.274¥/条",
  );
  assert.equal(
    routeBillingPriceLabel({ mode: "ratio" }, 0.274),
    "0.274¥/请求",
  );
  assert.equal(
    routeBillingPriceLabel(
      {
        mode: "ratio",
        unit: "request",
        imagePriceMinor: 20000,
        imageResolutionPricesMinor: { "1K": 20000, "2K": 30000 },
        secondResolutionPricesMinor: { "1K": 99999, "2K": 88888 },
      },
      60000,
      "image",
      "2K",
    ),
    "30000.000¥/请求",
  );
});

test("quota price suffix formatter respects configured currency and precision", () => {
  const functionNames = [
    "studioQuotaAmount",
    "studioQuotaMaximumFractionDigits",
    "studioQuotaCurrencySymbol",
    "formatStudioQuotaWithSuffix",
  ];
  const helperJs = functionNames
    .map((name) => findFunctionDeclaration(apiClient, name).getFullText(apiClient))
    .map((source) =>
      ts.transpile(source.replace(/export\s+function\s+/, "function "), {
        target: ts.ScriptTarget.ES2020,
      }),
    )
    .join("\n");
  const formatStudioQuotaWithSuffix = vm.runInNewContext(
    `${helperJs}; formatStudioQuotaWithSuffix`,
  );
  const baseConfig = {
    quotaPerUnit: 500000,
    quotaDisplayType: "CNY",
    usdExchangeRate: 1,
    customCurrencySymbol: "积分",
    customCurrencyExchangeRate: 1,
  };

  assert.equal(formatStudioQuotaWithSuffix(95000, baseConfig), "0.19¥");
  assert.equal(formatStudioQuotaWithSuffix(2550000, baseConfig), "5.1¥");
  assert.equal(
    formatStudioQuotaWithSuffix(95000, {
      ...baseConfig,
      quotaDisplayType: "USD",
    }),
    "0.19$",
  );
  assert.equal(
    formatStudioQuotaWithSuffix(95000, {
      ...baseConfig,
      quotaDisplayType: "CUSTOM",
    }),
    "0.19积分",
  );
  assert.equal(
    formatStudioQuotaWithSuffix(95000, {
      ...baseConfig,
      quotaDisplayType: "TOKENS",
    }),
    "95,000",
  );
});

test("route price never falls back to a zero base price when resolution pricing exists", () => {
  const declaration = promptDock.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "routeBillingPriceLabel",
  );
  assert.ok(declaration, "Expected routeBillingPriceLabel helper");
  const helperJs = ts.transpile(declaration.getFullText(promptDock), {
    target: ts.ScriptTarget.ES2020,
  });
  const routeBillingPriceLabel = vm.runInNewContext(
    `const formatStudioQuotaWithSuffix = (quota) => (quota / 500000).toFixed(2) + "¥"; ${helperJs}; routeBillingPriceLabel`,
  );

  const billing = {
    mode: "tiered_expr",
    unit: "request",
    unitPriceMinor: 0,
    requestPriceMinor: 0,
    requestResolutionPricesMinor: {
      "480p": 2550000,
      "720p": 2550000,
      "1080p": 2550000,
    },
  };

  assert.equal(
    routeBillingPriceLabel(billing, 0, "video"),
    "5.10¥/条",
  );
  assert.equal(
    routeBillingPriceLabel(billing, 0, "video", "1080P"),
    "5.10¥/条",
  );
  assert.equal(
    routeBillingPriceLabel(
      {
        ...billing,
        requestResolutionPricesMinor: { "720p": 1500000, "1080p": 2550000 },
      },
      0,
      "video",
    ),
    "3.00¥–5.10¥/条",
  );
});

test("maxReferenceImages=0 disables reference images and preserves legacy defaults", () => {
  const declaration = promptDock.statements.find(
    (node) =>
      ts.isFunctionDeclaration(node) &&
      node.name?.text === "canUseReferenceImage",
  );
  assert.ok(declaration, "Expected canUseReferenceImage helper");
  const helperJs = ts.transpile(declaration.getFullText(promptDock), {
    target: ts.ScriptTarget.ES2020,
  });
  const canUseReferenceImage = vm.runInNewContext(
    `${helperJs}; canUseReferenceImage`,
  );

  assert.equal(
    canUseReferenceImage({
      capabilities: { maxReferenceImages: 0, inputModes: ["image"] },
    }),
    false,
  );
  assert.equal(
    canUseReferenceImage({
      capabilities: { maxReferenceImages: 0, inputModes: [] },
    }),
    false,
  );
  assert.equal(canUseReferenceImage({ capabilities: { inputModes: [] } }), true);
  assert.equal(
    canUseReferenceImage({
      capabilities: { maxReferenceImages: null, inputModes: [] },
    }),
    true,
  );
  assert.equal(
    canUseReferenceImage({
      capabilities: { maxReferenceImages: 4, inputModes: ["video"] },
    }),
    true,
  );
});

test("zero limit closes image reference mode even when image input mode is declared", () => {
  const expression = findVariableInitializer(
    promptDock,
    "canUseAnyReference",
  );
  assert.equal(
    evaluateExpression(promptDock, expression, {
      isVideo: false,
      canUseImageReference: false,
      canUseVideoReference: false,
      canUseAudioReference: false,
      selectedModel: {
        capabilities: { maxReferenceImages: 0, inputModes: ["image"] },
      },
      framesModeSupported: false,
      imageModeSupported: true,
    }),
    false,
  );
});

test("picker blocks new images at zero while selected images remain removable", () => {
  const uploadReason = findVariableInitializer(
    assetPicker,
    "uploadDisabledReason",
  );
  assert.equal(
    evaluateExpression(assetPicker, uploadReason, {
      type: "image",
      maxSelections: 0,
      capabilities: { maxReferenceImages: 0 },
    }),
    "当前模型不支持参考图片",
  );
  assert.equal(
    evaluateExpression(assetPicker, uploadReason, {
      type: "image",
      maxSelections: 1,
      capabilities: { maxReferenceImages: 0 },
    }),
    null,
  );

  const selectionLimit = findVariableInitializer(
    assetPicker,
    "selectionLimitReached",
  );
  assert.equal(
    evaluateExpression(assetPicker, selectionLimit, {
      selected: false,
      selectedIds: ["existing"],
      maxSelections: 0,
    }),
    true,
  );
  assert.equal(
    evaluateExpression(assetPicker, selectionLimit, {
      selected: true,
      selectedIds: ["existing"],
      maxSelections: 0,
    }),
    false,
  );
  assert.equal(
    evaluateExpression(assetPicker, selectionLimit, {
      selected: false,
      selectedIds: ["existing"],
      maxSelections: 2,
    }),
    false,
  );
});

test("generation validation rejects existing images when the explicit limit is zero", () => {
  const condition = findIfCondition(
    promptDock,
    "selectedModel.capabilities.maxReferenceImages === 0",
  );
  const selectedModel = { capabilities: { maxReferenceImages: 0 } };
  assert.equal(
    evaluateExpression(promptDock, condition, {
      selectedModel,
      referenceAssets: [{ id: "existing" }],
      referenceFiles: [],
    }),
    true,
  );
  assert.equal(
    evaluateExpression(promptDock, condition, {
      selectedModel,
      referenceAssets: [],
      referenceFiles: ["local-file"],
    }),
    true,
  );
  assert.equal(
    evaluateExpression(promptDock, condition, {
      selectedModel,
      referenceAssets: [],
      referenceFiles: [],
    }),
    false,
  );
});

test("disallowed local reference files show a remove action that clears them", () => {
  const visibility = findVariableInitializer(
    promptDock,
    "hasDisallowedReferenceFiles",
  );
  assert.equal(
    evaluateExpression(promptDock, visibility, {
      referenceFiles: ["local-file"],
      selectedModel: { capabilities: { maxReferenceImages: 0 } },
    }),
    true,
  );
  assert.equal(
    evaluateExpression(promptDock, visibility, {
      referenceFiles: ["local-file"],
      selectedModel: { capabilities: { maxReferenceImages: 2 } },
    }),
    false,
  );

  const button = findButtonByAriaLabel(
    promptDock,
    "移除已选本地参考图片",
  );
  const onClick = button.attributes.properties.find(
    (attribute) =>
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText(promptDock) === "onClick",
  );
  assert.ok(onClick && ts.isJsxExpression(onClick.initializer));
  let clearsFiles = false;
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(promptDock) === "setReferenceFiles" &&
      node.arguments.length === 1 &&
      ts.isArrayLiteralExpression(node.arguments[0]) &&
      node.arguments[0].elements.length === 0
    ) {
      clearsFiles = true;
    }
    ts.forEachChild(node, visit);
  }
  visit(onClick.initializer.expression);
  assert.equal(clearsFiles, true);
});
