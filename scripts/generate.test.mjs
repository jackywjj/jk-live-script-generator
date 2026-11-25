import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";

const script = new URL("./generate.mjs", import.meta.url).href;
const configExample = fileURLToPath(new URL("../config.example.json", import.meta.url));
const intakeExample = fileURLToPath(new URL("../intake.example.json", import.meta.url));
const config = JSON.parse(readFileSync(configExample, "utf8"));
const intake = JSON.parse(readFileSync(intakeExample, "utf8"));
const tempDir = mkdtempSync(join(tmpdir(), "jk-live-cli-test-"));
const tempConfig = join(tempDir, "config.json");
const tempIntake = join(tempDir, "intake.json");
writeFileSync(tempConfig, "{}");
writeFileSync(tempIntake, "{}");
after(() => {
  unlinkSync(tempConfig);
  unlinkSync(tempIntake);
  rmdirSync(tempDir);
});

const deepseekUrl = "https://api.deepseek.com/chat/completions";
const secret = "fake-key-for-offline-test";
const kimiKey = "fake-moonshot-key";
const qwenKey = "fake-dashscope-key";
const privateIntake = "fake-private-intake-for-offline-test";

// Replace fetch before importing the CLI, so a mismatch can never reach the network.
const bootstrap = `
  import assert from "node:assert/strict";
  const [script, fixturesJson, ...args] = process.argv.slice(1);
  const { reply, resolvedUrl } = JSON.parse(fixturesJson);
  process.argv = [process.execPath, script, ...args];
  if (resolvedUrl) {
    globalThis.URL = class extends URL {
      constructor(input, base) {
        super(base ? resolvedUrl : input, base);
      }
    };
  }
  globalThis.fetch = async (url, options) => {
    if (!reply || url.href !== reply.url || options.redirect !== "manual") {
      process.stderr.write("Unexpected fetch call or options\\n");
      process.exit(99);
    }
    if (reply.expectedRequest || reply.expectedIntake) {
      const { messages: [instructions, data], ...parameters } = JSON.parse(options.body);
      assert.equal(instructions.role, "system");
      assert.equal(data.role, "user");
      if (reply.expectedRequest) {
        assert.deepEqual(parameters, reply.expectedRequest);
        assert.equal(options.headers.Authorization, "Bearer " + reply.expectedKey);
      }
      for (const instruction of reply.expectedInstructions ?? []) {
        assert.ok(instructions.content.includes(instruction));
      }
      if (reply.expectedIntake) {
        assert.deepEqual(JSON.parse(data.content.slice(data.content.indexOf("\\n") + 1)), reply.expectedIntake);
      }
    }
    if (reply.failure) throw new Error(reply.failure);
    return new Response(reply.body, { status: reply.status, headers: reply.headers });
  };
  await import(script);
`;

function run(args, { configPath = configExample, intakePath = intakeExample, reply, resolvedUrl } = {}) {
  const result = spawnSync(process.execPath, [
    "--input-type=module", "--eval", bootstrap, "--",
    script, JSON.stringify({ reply, resolvedUrl }),
    "--config", configPath, "--intake", intakePath, ...args,
  ], {
    encoding: "utf8",
    env: {
      DEEPSEEK_API_KEY: secret,
      MINIMAX_API_KEY: secret,
      MOONSHOT_API_KEY: kimiKey,
      DASHSCOPE_API_KEY: qwenKey,
    },
    timeout: 5000,
  });
  assert.ifError(result.error);
  return result;
}

function writeConfig(provider, baseUrl) {
  const local = structuredClone(config);
  local.providers[provider].baseUrl = baseUrl;
  writeFileSync(tempConfig, JSON.stringify(local));
  return tempConfig;
}

for (const [provider, baseUrl] of [
  ["deepseek", "https://api.deepseek.com"],
  ["minimax", "https://api.minimaxi.com/v1"],
  ["minimax", "https://api.minimax.io/v1"],
]) {
  test(`validates the configured ${baseUrl} endpoint offline`, () => {
    const result = run(["--provider", provider, "--validate-only"], {
      configPath: writeConfig(provider, baseUrl),
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).endpoint, baseUrl + "/chat/completions");
  });
}

test("rejects unapproved origins and embedded credentials before fetch", () => {
  for (const baseUrl of [
    "https://example.invalid",
    "http://api.deepseek.com",
    "https://api.deepseek.com:8443",
    "https://user:password@api.deepseek.com",
    "https://api.minimaxi.com",
  ]) {
    const result = run(["--confirm-external"], { configPath: writeConfig("deepseek", baseUrl) });
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stderr, "Error: Unapproved deepseek API origin\n");
  }
});

test("rejects switching Kimi or Qwen to the other provider's host", () => {
  for (const [provider, baseUrl] of [
    ["kimi", "https://dashscope.aliyuncs.com"],
    ["qwen", "https://api.moonshot.cn"],
  ]) {
    const result = run(["--confirm-external", "--provider", provider], {
      configPath: writeConfig(provider, baseUrl),
    });
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stderr, `Error: Unapproved ${provider} API origin\n`);
  }
});

test("checks the resolved request URL before fetch", () => {
  for (const resolvedUrl of [
    "https://example.invalid/chat/completions",
    "https://user:password@api.deepseek.com/chat/completions",
  ]) {
    const result = run(["--confirm-external"], { resolvedUrl });
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stderr, "Error: API endpoint must use the configured HTTPS origin without credentials\n");
  }
});

test("requires explicit confirmation before fetch", () => {
  const result = run([]);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /External request not sent/);
});

test("stops at a redirect and does not print its location", () => {
  const result = run(["--confirm-external"], {
    reply: {
      url: deepseekUrl,
      status: 307,
      headers: { Location: `https://example.invalid/${privateIntake}` },
    },
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "Error: Provider request failed: HTTP 307\n");
});

test("keeps provider error bodies and network details out of CLI output", () => {
  const details = `${secret} ${privateIntake}`;
  for (const [reply, expectedError] of [
    [{ status: 401, body: JSON.stringify({ error: { message: details } }) },
      "Provider request failed: HTTP 401"],
    [{ status: 503, body: details }, "Provider request failed: HTTP 503"],
    [{ status: 200, body: details }, "Provider returned non-JSON response (HTTP 200)"],
    [{ status: 200, body: JSON.stringify({ base_resp: { status_msg: details } }) },
      "Provider response did not contain generated content"],
    [{ failure: details }, "Provider request failed"],
  ]) {
    const result = run(["--confirm-external"], { reply: { url: deepseekUrl, ...reply } });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, `Error: ${expectedError}\n`);
  }
});

test("prints a successful response and appends the local attribution", () => {
  const result = run(["--confirm-external"], {
    reply: {
      url: deepseekUrl,
      status: 200,
      body: JSON.stringify({ choices: [{ message: { content: "离线口播示例" } }] }),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /^离线口播示例\n\n---/);
  assert.match(result.stdout, /Skill 作者与联系信息/);
});

for (const [provider, url, key, parameters] of [
  ["deepseek", deepseekUrl, secret, { model: "deepseek-flash", temperature: 0.8, max_tokens: 7000 }],
  ["kimi", "https://api.moonshot.cn/v1/chat/completions", kimiKey, {
    model: "kimi-k2.6", max_completion_tokens: 7000, thinking: { type: "disabled" },
  }],
  ["qwen", "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", qwenKey, {
    model: "qwen-plus", temperature: 0.8, max_tokens: 7000,
  }],
  ["minimax", "https://api.minimaxi.com/v1/chat/completions", secret, {
    model: "MiniMax-M2.7", temperature: 1, max_completion_tokens: 7000,
  }],
]) {
  test(`selects the ${provider} endpoint, credentials, and request fields`, () => {
    const args = ["--provider", provider];
    const preview = run([...args, "--validate-only"]);
    assert.equal(preview.status, 0, preview.stderr);
    assert.equal(JSON.parse(preview.stdout).endpoint, url);
    assert.equal(JSON.parse(preview.stdout).model, parameters.model);

    const result = run([...args, "--confirm-external", "--no-attribution"], {
      reply: {
        url,
        status: 200,
        expectedRequest: { ...parameters, stream: false },
        expectedKey: key,
        body: JSON.stringify({ choices: [{ message: { content: "离线口播示例" } }] }),
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "离线口播示例\n");
  });
}

const verifiedProduct = {
  verified: true,
  name: "写作练习包",
  type: "资料包",
  price: "10 元",
  deliverables: ["三份练习材料"],
  purchaseEntry: "视频号小店商品页",
  paymentOwner: "练习包工作室",
  deliveryOwner: "练习包工作室",
  serviceBoundary: "仅交付练习材料",
};
const { verified, ...legacyProduct } = verifiedProduct;
const { product, ...contentIntake } = intake;
const contentOnlyInstructions = [
  "全稿禁止介绍商品、价格、权益和购买入口，禁止引导购买、付费、下单或预售",
  "忽略采集资料中的销售目标和购买要求",
  "live.callToAction 明确要求预约下一场直播时，可以邀请预约",
  "其余情况以免费内容练习收口",
];

function expectScript(input, expectedIntake, expectedInstructions, scriptText) {
  writeFileSync(tempIntake, JSON.stringify(input));
  const result = run(["--confirm-external", "--no-attribution"], {
    intakePath: tempIntake,
    reply: {
      url: deepseekUrl,
      status: 200,
      expectedIntake,
      expectedInstructions,
      body: JSON.stringify({ choices: [{ message: { content: scriptText } }] }),
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, scriptText + "\n");
}

test("requests a content-only script with no product and no call to action", () => {
  const input = structuredClone(contentIntake);
  delete input.live.callToAction;
  expectScript(input, input, contentOnlyInstructions, "今天先做一次免费练习。");
});

test("accepts a null product and can close with the next live session", () => {
  expectScript({ ...contentIntake, product: null }, contentIntake, contentOnlyInstructions, "欢迎预约下一场直播。");
});

test("omits unverified or incomplete products, even when intake asks for purchases", () => {
  const input = {
    ...contentIntake,
    live: { ...intake.live, callToAction: "下单购买" },
  };
  for (const pendingProduct of [
    product,
    { name: "准备中的练习包" },
    legacyProduct,
    { ...verifiedProduct, verified: "true" },
    { ...verifiedProduct, purchaseEntry: "" },
    { ...verifiedProduct, price: "待确认" },
    { ...verifiedProduct, deliverables: ["三份练习材料", " 待核实 "] },
  ]) {
    expectScript({ ...input, product: pendingProduct }, input, contentOnlyInstructions, "现在试着做一次练习。");
  }
});

test("retains verified product facts for a product-focused script", () => {
  const input = {
    ...contentIntake,
    live: { ...intake.live, callToAction: "查看商品页" },
    product: verifiedProduct,
  };
  expectScript(input, input, ["仅在已核实商品与本场问题匹配"], "想继续练习，可以查看商品页。");
});

test("preview lists product data only when the request includes it", () => {
  for (const [product, includesProduct] of [[null, false], [verifiedProduct, true]]) {
    writeFileSync(tempIntake, JSON.stringify({ ...contentIntake, product }));
    const result = run(["--validate-only"], { intakePath: tempIntake });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).dataCategories.includes("产品及定价"), includesProduct);
  }
});

test("still rejects missing core live information without a product", () => {
  writeFileSync(tempIntake, JSON.stringify({ ...contentIntake, live: { ...intake.live, topic: "" } }));
  const result = run(["--validate-only"], { intakePath: tempIntake });
  assert.equal(result.status, 1);
  assert.equal(result.stderr, "Error: Missing or invalid intake fields: live.topic\n");
});
