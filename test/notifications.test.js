import test from "node:test";
import assert from "node:assert/strict";
import { familySmsPlan } from "../server/notifications.js";

test("sends one family confirmation per unique phone", () => {
  const siblings = [
    { batch_position: 1, answers: { name: "أحمد", phone: "0501234567" } },
    { batch_position: 2, answers: { name: "محمد", phone: "0501234567" } },
    { batch_position: 3, answers: { name: "علي", phone: "0551234567" } }
  ];
  assert.deepEqual(familySmsPlan(siblings, siblings[0]), { send: true, names: ["أحمد", "محمد"] });
  assert.deepEqual(familySmsPlan(siblings, siblings[1]), { send: false, names: ["أحمد", "محمد"] });
  assert.deepEqual(familySmsPlan(siblings, siblings[2]), { send: true, names: ["علي"] });
});
