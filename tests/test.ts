/// <reference lib="deno.ns" />

import { assert, assertEquals } from "jsr:@std/assert";
// import { DOMParser } from "jsr:@b-fuze/deno-dom";

// (globalThis as unknown).document = new DOMParser().parseFromString(
//   "",
//   "text/html",
// );

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

rules.forEach(({ name, validate, tests }) => {
  Deno.test(`Rule for ${name}`, () => {
    for (const { value, result } of tests) {
      assert(isJsonObject(value) && !isAnnotation(value));
      compareAnnotation(validate(value), result);
    }
  });
});

// function extractJsonFromRendered(_html: HTMLElement): string {
//   let result = "";
//
//   // Traverse all <code> elements
//   const codeElements = document.querySelectorAll("code");
//   for (const codeElement of Array.from(codeElements)) {
//     const parentDetails = codeElement.closest("details");
//     const insideSummary = codeElement.closest("summary");
//
//     if (parentDetails && !insideSummary) {
//       // Skip <code> inside <details> but not in <summary>
//       continue;
//     }
//
//     // Add text content to result
//     result += codeElement.textContent;
//   }
//
//   return result;
// }
//
// Deno.test("Annotation rendering contains the exact JSON value that was used for validation", () => {
//   const json = {};
//   assertStrictEquals(
//     json,
//     JSON.parse(
//       extractJsonFromRendered(renderValidationResult(json, validate(json))),
//     ),
//   );
// });
