// SPDX-FileCopyrightText: 2025 Kerstin Humm <kerstin@erictapen.name>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference lib="deno.ns" />

import { assert, assertEquals } from "jsr:@std/assert";
// import { DOMParser } from "jsr:@b-fuze/deno-dom";

// (globalThis as unknown).document = new DOMParser().parseFromString(
//   "",
//   "text/html",
// );

import {
  AnnotatedJson,
  isAnnotatedArray,
  isAnnotatedObject,
  isAnnotation,
  isJsonArray,
  isJsonObject,
  JsonValue,
  rules,
} from "../src/index.ts";

function compareAnnotation(
  annotated: AnnotatedJson,
  testStub: JsonValue,
) {
  if (isJsonObject(testStub)) {
    for (const name in testStub) {
      assert(
        isAnnotatedObject(annotated),
        `Not an object: ${annotated}`,
      );
      assert(name in annotated.object, `${name} is not in ${annotated}`);
      compareAnnotation(
        annotated.object[name]!,
        testStub[name]!,
      );
    }
  } else if (isJsonArray(testStub)) {
    assert(isAnnotatedArray(annotated), `Not an array: ${annotated}`);
    assertEquals(annotated.array.length, testStub.length);
    for (let i = 0, len = testStub.length; i < len; i++) {
      compareAnnotation(
        annotated.array[i]!,
        testStub[i]!,
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
