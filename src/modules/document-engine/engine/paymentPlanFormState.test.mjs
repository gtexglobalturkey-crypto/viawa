import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith(".") && !specifier.endsWith(".ts")) {
        return nextResolve(`${specifier}.ts`, context);
      }
      throw error;
    }
  },
});

const {
  PAYMENT_PLAN_ROW_COUNT,
  createEmptyPaymentPlanFormState,
  paymentPlanFormStateFromRecord,
  updatePaymentPlanRowField,
  paymentPlanFormStateToRecord,
  sumPaymentPlanFormAmounts,
} = await import(
  new URL("./paymentPlanFormState.ts", import.meta.url)
);

test("createEmptyPaymentPlanFormState: exactly 5 independent, blank rows", () => {
  const state = createEmptyPaymentPlanFormState();
  assert.equal(state.length, 5);
  assert.equal(PAYMENT_PLAN_ROW_COUNT, 5);
  for (const row of state) {
    assert.deepEqual(row, { dueDate: "", amount: "", payee: "" });
  }
});

// Sprint 25.8/Adım 2 — Test scenario 1: only the first row is used.
test("only the first row can be filled while the rest stay blank and still save cleanly", () => {
  let state = createEmptyPaymentPlanFormState();
  state = updatePaymentPlanRowField(state, 0, "dueDate", "15.09.2026");
  state = updatePaymentPlanRowField(state, 0, "amount", "65000");
  state = updatePaymentPlanRowField(state, 0, "payee", "Terrapinn Katılım Bedeli");

  const record = paymentPlanFormStateToRecord(state);
  assert.equal(record.length, 5);
  assert.deepEqual(record[0], {
    dueDate: "15.09.2026",
    amount: 65000,
    payee: "Terrapinn Katılım Bedeli",
  });
  for (let index = 1; index < 5; index += 1) {
    assert.deepEqual(record[index], {
      dueDate: null,
      amount: null,
      payee: null,
    });
  }
});

// Sprint 25.8/Adım 2 — Test scenario 2: all 5 rows can be filled
// independently.
test("all 5 rows can be filled independently of each other", () => {
  let state = createEmptyPaymentPlanFormState();
  for (let index = 0; index < 5; index += 1) {
    state = updatePaymentPlanRowField(
      state,
      index,
      "dueDate",
      `0${index + 1}.01.2027`,
    );
    state = updatePaymentPlanRowField(
      state,
      index,
      "amount",
      String((index + 1) * 1000),
    );
    state = updatePaymentPlanRowField(
      state,
      index,
      "payee",
      `Taksit ${index + 1}`,
    );
  }

  const record = paymentPlanFormStateToRecord(state);
  for (let index = 0; index < 5; index += 1) {
    assert.equal(record[index].dueDate, `0${index + 1}.01.2027`);
    assert.equal(record[index].amount, (index + 1) * 1000);
    assert.equal(record[index].payee, `Taksit ${index + 1}`);
  }
});

// Rows must never affect one another.
test("editing one row never changes the others", () => {
  let state = createEmptyPaymentPlanFormState();
  state = updatePaymentPlanRowField(state, 2, "payee", "Sadece 3. satır");

  for (const [index, row] of state.entries()) {
    if (index === 2) {
      assert.equal(row.payee, "Sadece 3. satır");
    } else {
      assert.deepEqual(row, { dueDate: "", amount: "", payee: "" });
    }
  }
});

// Sprint 25.8/Adım 2 — Test scenario 3: blank rows never error and
// never produce a stray placeholder value (0, "undefined", NaN).
test("blank rows convert to fully-null entries, never 0/NaN/empty-string placeholders", () => {
  const state = createEmptyPaymentPlanFormState();
  const record = paymentPlanFormStateToRecord(state);

  assert.equal(record.length, 5);
  for (const entry of record) {
    assert.deepEqual(entry, { dueDate: null, amount: null, payee: null });
  }
});

test("an unparsable or negative amount is stored as null rather than crashing or saving garbage", () => {
  let state = createEmptyPaymentPlanFormState();
  state = updatePaymentPlanRowField(state, 0, "amount", "not-a-number");
  assert.equal(paymentPlanFormStateToRecord(state)[0].amount, null);

  state = updatePaymentPlanRowField(
    createEmptyPaymentPlanFormState(),
    0,
    "amount",
    "-500",
  );
  assert.equal(paymentPlanFormStateToRecord(state)[0].amount, null);

  state = updatePaymentPlanRowField(
    createEmptyPaymentPlanFormState(),
    0,
    "amount",
    "1250.50",
  );
  assert.equal(paymentPlanFormStateToRecord(state)[0].amount, 1250.5);
});

// Sprint 25.8/Adım 2 — Test scenario 4: reopening the form reproduces
// exactly what was saved, positionally, including a shorter saved array
// and null/undefined records (a brand-new opportunity).
test("paymentPlanFormStateFromRecord: reloads a saved plan exactly, positionally, padding missing rows", () => {
  const saved = [
    { dueDate: "15.09.2026", amount: 65000, payee: "Terrapinn Katılım Bedeli" },
    { dueDate: "15.10.2026", amount: 10000, payee: "EXPOVIA Hizmet Bedeli" },
  ];

  const reloaded = paymentPlanFormStateFromRecord(saved);
  assert.equal(reloaded.length, 5);
  assert.deepEqual(reloaded[0], {
    dueDate: "15.09.2026",
    amount: "65000",
    payee: "Terrapinn Katılım Bedeli",
  });
  assert.deepEqual(reloaded[1], {
    dueDate: "15.10.2026",
    amount: "10000",
    payee: "EXPOVIA Hizmet Bedeli",
  });
  for (let index = 2; index < 5; index += 1) {
    assert.deepEqual(reloaded[index], {
      dueDate: "",
      amount: "",
      payee: "",
    });
  }

  assert.deepEqual(
    paymentPlanFormStateFromRecord(null),
    createEmptyPaymentPlanFormState(),
  );
  assert.deepEqual(
    paymentPlanFormStateFromRecord(undefined),
    createEmptyPaymentPlanFormState(),
  );
});

test("a full round trip (fill -> persist shape -> reload) reproduces the same values", () => {
  let state = createEmptyPaymentPlanFormState();
  state = updatePaymentPlanRowField(state, 0, "dueDate", "15.09.2026");
  state = updatePaymentPlanRowField(state, 0, "amount", "65000");
  state = updatePaymentPlanRowField(state, 0, "payee", "Terrapinn Katılım Bedeli");
  state = updatePaymentPlanRowField(state, 4, "amount", "500.25");

  const record = paymentPlanFormStateToRecord(state);
  const reloaded = paymentPlanFormStateFromRecord(record);

  assert.deepEqual(reloaded[0], {
    dueDate: "15.09.2026",
    amount: "65000",
    payee: "Terrapinn Katılım Bedeli",
  });
  assert.equal(reloaded[4].amount, "500.25");
});

// RC-02 — sumPaymentPlanFormAmounts backs the payment plan panel's
// display-only "Vadeler Toplamı" summary (the actual enforced total
// check lives server-side in generateParticipationContract.ts).
test("sumPaymentPlanFormAmounts: sums only the filled rows, blanks count as 0", () => {
  let state = createEmptyPaymentPlanFormState();
  state = updatePaymentPlanRowField(state, 0, "amount", "5000");
  state = updatePaymentPlanRowField(state, 1, "amount", "4000");
  state = updatePaymentPlanRowField(state, 2, "amount", "3500");

  assert.equal(sumPaymentPlanFormAmounts(state), 12500);
});

test("sumPaymentPlanFormAmounts: an all-blank plan sums to 0", () => {
  assert.equal(
    sumPaymentPlanFormAmounts(createEmptyPaymentPlanFormState()),
    0,
  );
});

test("sumPaymentPlanFormAmounts: unparsable or negative amounts contribute 0, matching what persisting would save", () => {
  let state = createEmptyPaymentPlanFormState();
  state = updatePaymentPlanRowField(state, 0, "amount", "1000");
  state = updatePaymentPlanRowField(state, 1, "amount", "not-a-number");
  state = updatePaymentPlanRowField(state, 2, "amount", "-500");

  assert.equal(sumPaymentPlanFormAmounts(state), 1000);
});

test("sumPaymentPlanFormAmounts: decimal amounts sum safely (no floating point drift)", () => {
  let state = createEmptyPaymentPlanFormState();
  state = updatePaymentPlanRowField(state, 0, "amount", "0.1");
  state = updatePaymentPlanRowField(state, 1, "amount", "0.2");

  assert.ok(
    Math.abs(sumPaymentPlanFormAmounts(state) - 0.3) < 0.001,
  );
});
