/// <reference lib="deno.ns" />

import { assert, assertEquals } from "jsr:@std/assert";

import {
  isAnnotation,
  isJsonArray,
  isJsonObject,
  JsonAnnotation,
  JsonValue,
  rules,
} from "../src/index.ts";

function compareAnnotation(
  annotated: JsonValue<JsonAnnotation>,
  testStub: JsonValue<string>,
) {
  if (isJsonObject(testStub)) {
    for (const name in testStub) {
      assert(
        isJsonObject(annotated) && !isAnnotation(annotated),
        `Not an object: ${annotated}`,
      );
      assert(name in annotated, `${name} is not in ${annotated}`);
      compareAnnotation(
        annotated[name] as JsonValue<JsonAnnotation>,
        testStub[name] as JsonValue<string>,
      );
    }
  } else if (isJsonArray(testStub)) {
    assert(isJsonArray(annotated), `Not an array: ${annotated}`);
    assertEquals(annotated.length, testStub.length);
    for (let i = 0, len = testStub.length; i < len; i++) {
      compareAnnotation(
        annotated[i] as JsonValue<JsonAnnotation>,
        testStub[i] as JsonValue<string>,
      );
    }
  } else if (typeof testStub === "string") {
    assert(isAnnotation(annotated), `Not an annotation: ${annotated}`);
    assertEquals(annotated.id ?? annotated.kind, testStub);
  }
}

rules.forEach(({ validate, tests }, index) => {
  Deno.test(`Rule ${index + 1}`, () => {
    for (const { value, result } of tests) {
      assert(isJsonObject(value) && !isAnnotation(value));
      compareAnnotation(validate(value), result);
    }
  });
});
