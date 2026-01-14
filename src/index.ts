// SPDX-FileCopyrightText: 2025 Kerstin Humm <kerstin@erictapen.name>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

export function init() {
  document.getElementById("ap-input")?.addEventListener(
    "input",
    handleApObject,
  );
  const input = document.getElementById("ap-input") as HTMLInputElement;
  input.value = globalThis.location.pathname.slice(1);
  input.dispatchEvent(new Event("input", {}));
}

function isUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// `fetch` an URL while accepting `application/activity+json` and signal a few
// possible error modes in the return value
function fetchApObject(
  url: string,
): Promise<JsonValue | DocumentFragment> {
  return fetch(url, {
    headers: { Accept: "application/activity+json" },
  }).then(
    (response) => {
      return response.json();
    },
  ).catch((error) => {
    if (error instanceof TypeError) {
      console.error("CORS error", error);
      return cloneTemplate("cors-error");
    } else {
      console.error("Unhandled fetch error: ", error);
      return cloneTemplate("fetch-error");
    }
  });
}

function cloneTemplate(id: string): DocumentFragment {
  return (document.getElementById(id) as HTMLTemplateElement).content
    .cloneNode(true) as DocumentFragment;
}

export async function handleApObject(_: Event) {
  const input = document.getElementById("ap-input") as HTMLInputElement;
  const searchResult = document.getElementById("searchresult") as HTMLElement;
  let jsonOrErrorMessage: JsonValue | DocumentFragment;
  if (input.value === "") {
    jsonOrErrorMessage = cloneTemplate("empty-data");
  } else if (isUrl(input.value)) {
    globalThis.history.replaceState({}, "", `/${input.value}`);
    jsonOrErrorMessage = await fetchApObject(input.value);
    console.log(jsonOrErrorMessage);
  } else {
    try {
      jsonOrErrorMessage = JSON.parse(input.value) as JsonValue;
    } catch {
      jsonOrErrorMessage = cloneTemplate("invalid-data");
    }
  }
  if (!(jsonOrErrorMessage instanceof DocumentFragment)) {
    const json = jsonOrErrorMessage as JsonValue;
    if (!isJsonObject(json)) {
      jsonOrErrorMessage = cloneTemplate("invalid-activitystreams-object");
    } else {
      const validationResult: AnnotatedJson = validate(json);
      console.log(validationResult);
      searchResult.replaceChildren(
        renderAnnotatedJson(json, validationResult),
      );
      return;
    }
  }
  const errorMessage = jsonOrErrorMessage;
  globalThis.history.replaceState({}, "", "/");
  searchResult.replaceChildren(errorMessage);
}

const legalTimeZones: string[] = [];

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

// For expressing errors as return values
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

type AnnotationKind = "Violation" | "Warning" | "Note" | "Correct";

export type Annotation = {
  kind: AnnotationKind;
  id: string | null;
  text: string;
  reference: string | null;
};

export function isAnnotation(value: unknown): value is Annotation {
  if (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "id" in value &&
    "text" in value &&
    "reference" in value
  ) {
    const { kind, id, text, reference } = value as Annotation;
    return (
      (kind === "Violation" || kind === "Warning" || kind === "Note" ||
        kind === "Correct") &&
      (id === null || typeof id === "string") &&
      typeof text === "string" &&
      (reference === null || typeof reference === "string")
    );
  }
  return false;
}

type JsonPrimitive = number | string | boolean | null;

function isPrimitive(
  value: unknown,
): value is JsonPrimitive {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

export type JsonValue =
  | JsonPrimitive
  | { [key: string]: JsonValue }
  | JsonValue[];

export function isJsonObject(
  value: unknown,
): value is { [key: string]: JsonValue } {
  return !Array.isArray(value) && typeof value === "object" && value !== null &&
    Object.values(value).reduce((acc, v) => acc && isJsonValue(v), true);
}

export function isJsonArray(value: unknown): value is JsonValue[] {
  return Array.isArray(value) &&
    value.reduce((acc, v) => acc && isJsonValue(v), true);
}

function isJsonValue(value: unknown): value is JsonValue {
  return isJsonObject(value) || isJsonArray(value) || isPrimitive(value);
}

export type AnnotatedJson =
  | Annotation
  | { annotations: Annotation[]; object: { [key: string]: AnnotatedJson } }
  | { annotations: Annotation[]; array: AnnotatedJson[] };

export function isAnnotatedObject(
  value: unknown,
): value is {
  annotations: Annotation[];
  object: { [key: string]: AnnotatedJson };
} {
  return typeof value === "object" && value !== null &&
    "annotations" in value && "object" in value;
}

export function isAnnotatedArray(
  value: unknown,
): value is { annotations: Annotation[]; array: AnnotatedJson[] } {
  return typeof value === "object" && value !== null &&
    "annotations" in value && "array" in value;
}

// Recursively merge an AnnotatedJson
function mergeAnnotatedJson(
  a: AnnotatedJson,
  b: AnnotatedJson,
): Result<AnnotatedJson, string> {
  if (isAnnotation(a) && isAnnotation(b)) {
    return { ok: false, error: `Can't merge two annotations ${a} ${b}` };
  } else if (isAnnotatedObject(a) && isAnnotatedObject(b)) {
    const mergedObject: { [key: string]: AnnotatedJson } = { ...a.object };
    for (const [k, v] of Object.entries(b.object)) {
      if (k in mergedObject) {
        const merge = mergeAnnotatedJson(mergedObject[k]!, b.object[k]!);
        if (merge.ok) {
          mergedObject[k] = merge.value;
        } else {
          return merge;
        }
      } else {
        mergedObject[k] = v;
      }
    }
    return {
      ok: true,
      value: {
        annotations: [...a.annotations, ...b.annotations],
        object: mergedObject,
      },
    };
  } else if (isAnnotatedArray(a) && isAnnotatedArray(b)) {
    return {
      ok: true,
      value: {
        annotations: [...a.annotations, ...b.annotations],
        array: [...a.array, ...b.array],
      },
    };
  } else {
    const aType = (ann: AnnotatedJson) =>
      isAnnotatedObject(ann)
        ? "object"
        : (isAnnotatedArray(ann) ? "array" : "annotation");
    return {
      ok: false,
      error: `Can't merge as types differ: ${aType(a)}, ${aType(b)}`,
    };
  }
}

type Test = {
  value: JsonValue;
  // TODO this needs to be able to express annotated objects and arrays
  result: JsonValue;
};

type Rule = {
  name: string;
  validate: (
    self: { [key: string]: JsonValue },
  ) => AnnotatedJson;
  tests: Test[];
};

export const rules: Rule[] = [
  {
    name: "timezone attribute",
    validate: (self) => {
      if (!("timezone" in self)) {
        return { annotations: [], object: {} };
      } else if (self["timezone"] === null) {
        return {
          annotations: [],
          object: {
            "timezone": {
              kind: "Violation",
              id: "NoTimezoneSet",
              text: "The timezone property is either null or doesn't exist",
              reference: null,
            },
          },
        };
      } else if (typeof self["timezone"] !== "string") {
        return {
          annotations: [],
          object: {
            "timezone": {
              kind: "Violation",
              id: "InvalidTimezone",
              text: `The timezone {self["timezone"]} is not a string`,
              reference:
                "https://codeberg.org/fediverse/fep/src/branch/main/fep/8a8e/fep-8a8e.md#time-zone",
            },
          },
        };
      } else if (legalTimeZones.includes(self["timezone"])) {
        return {
          annotations: [],
          object: {
            "timezone": {
              kind: "Warning",
              id: "InvalidTimezone",
              text: `The timezone {self["timezone"]} is not a valid timezone`,
              reference:
                "https://codeberg.org/fediverse/fep/src/branch/main/fep/8a8e/fep-8a8e.md#time-zone",
            },
          },
        };
      } else {
        return {
          annotations: [],
          object: {
            "timezone": {
              kind: "Correct",
              id: null,
              reference: null,
              text: "Valid timezone",
            },
          },
        };
      }
    },
    tests: [{
      value: { timezone: null },
      result: { timezone: "NoTimezoneSet" },
    }, {
      value: {},
      result: {},
    }],
  },
  {
    name: "to attribute",
    validate: (self) => {
      if (isJsonArray(self["to"])) {
        return {
          annotations: [],
          object: {
            "to": {
              annotations: [],
              array: (self["to"].map((url: JsonValue) =>
                (typeof url === "string")
                  ? (isValidUrl(url)
                    ? {
                      kind: "Correct",
                      text: "Correct URL",
                      id: null,
                      reference: null,
                    }
                    : {
                      kind: "Violation",
                      text: "Not a valid URL",
                      id: null,
                      reference: null,
                    })
                  : {
                    kind: "Violation",
                    text: "url is not a string",
                    id: null,
                    reference: null,
                  }
              )),
            },
          },
        };
      } else {
        return {
          annotations: [],
          object: {
            "to": {
              kind: "Violation",
              id: "InvalidArray",
              text: `The to field {self["to"]} is not an array`,
              reference: null,
            },
          },
        };
      }
    },
    tests: [{
      value: { to: ["https://www.w3.org/ns/activitystreams#Public"] },
      result: { to: ["Correct"] },
    }],
  },
];

export function validate(
  apObject: Record<string, JsonValue>,
): AnnotatedJson {
  let result: AnnotatedJson = { annotations: [], object: {} };
  for (const rule of rules) {
    const merge = mergeAnnotatedJson(result, rule.validate(apObject));
    if (merge.ok) {
      result = merge.value;
    } else {
      console.error(merge.error);
    }
  }
  return result;
}

const annotationSignifiers: Record<AnnotationKind, string> = {
  "Violation": "🚫",
  "Warning": "⚠️",
  "Note": "📝",
  "Correct": "✅",
};

function code(text: string, indent: number): HTMLElement {
  const element = document.createElement("code");
  element.textContent = "  ".repeat(indent) + text;
  return element;
}

function details(
  summaryString: string,
  vRes: Annotation,
  indent: number,
): HTMLElement {
  const details = document.createElement("details");
  details.classList.add(vRes.kind);
  const summary = document.createElement("summary");
  summary.appendChild(code(summaryString, indent));
  const signifier = document.createElement("span");
  signifier.classList.add("unselectable");
  signifier.textContent = annotationSignifiers[vRes.kind];
  summary.appendChild(signifier);
  details.appendChild(summary);
  const annotation = document.createElement("div");
  annotation.classList.add("annotation");
  annotation.textContent = vRes.text;
  details.appendChild(annotation);
  return details;
}

function renderObjectName(
  name: string,
  value: JsonValue,
  indent: number,
  last: boolean,
): HTMLElement {
  if (isPrimitive(value)) {
    const result = document.createElement("div");
    result.appendChild(code(
      `"${name}": ${JSON.stringify(value)}${last ? "" : ","}`,
      indent,
    ));
    return result;
  } else if (isJsonObject(value)) {
    const result = document.createElement("div");
    result.appendChild(code(`"${name}": {\n`, indent));
    const names = Object.keys(value);
    for (let i = 0, len = names.length; i < len; i++) {
      const name = names[i] as string;
      if (value[name] !== undefined) {
        result.appendChild(
          renderObjectName(
            name,
            value[name] as JsonValue,
            indent + 1,
            i == len - 1,
          ),
        );
      }
    }
    result.appendChild(code(`${last ? "" : ","}\n`, indent));
    return result;
  } else if (isJsonArray(value)) {
    const result = document.createElement("div");
    result.appendChild(code(`"${name}": [\n`, indent));
    for (let i = 0, len = value.length; i < len; i++) {
      result.appendChild(
        renderJson(
          value[i] as JsonValue,
          indent + 1,
          i == len - 1,
        ),
      );
    }
    result.appendChild(code(`]${last ? "" : ","}\n`, indent));
    return result;
  }

  throw new Error(`Unhandled case: ${value satisfies never}`);
}

// Render an annotated JSON name/value pair
function renderAnnotatedObjectName(
  name: string,
  value: JsonValue,
  vRes: AnnotatedJson,
  indent: number,
  last: boolean,
): HTMLElement {
  if (isPrimitive(value) && isAnnotation(vRes)) {
    return details(
      `"${name}": ${JSON.stringify(value)}${last ? "" : ","}`,
      vRes,
      indent,
    );
  } else if (isJsonObject(value) && isAnnotatedObject(vRes)) {
    const result = document.createElement("div");
    result.appendChild(code(`"${name}": {\n`, indent));
    const names = Object.keys(value);
    for (let i = 0, len = names.length; i < len; i++) {
      const name = names[i] as string;
      if (value[name] !== undefined && vRes.object[name] !== undefined) {
        result.appendChild(
          renderAnnotatedObjectName(
            name,
            value[name] as JsonValue,
            vRes.object[name] as AnnotatedJson,
            indent + 1,
            i == len - 1,
          ),
        );
      } else {
        result.appendChild(
          renderObjectName(
            name,
            value[name] as JsonValue,
            indent + 1,
            i == len - 1,
          ),
        );
      }
    }
    result.appendChild(code(`${last ? "" : ","}\n`, indent));
    return result;
  } else if (isJsonArray(value) && isAnnotatedArray(vRes)) {
    const result = document.createElement("div");
    result.appendChild(code(`"${name}": [\n`, indent));
    for (let i = 0, len = value.length; i < len; i++) {
      result.appendChild(
        renderAnnotatedJson(
          value[i] as JsonValue,
          vRes.array[i] as AnnotatedJson,
          indent + 1,
          i == len - 1,
        ),
      );
    }
    result.appendChild(code(`]${last ? "" : ","}\n`, indent));
    return result;
  } else {
    // value doesn't have valid annotation
    return renderObjectName(name, value, indent, last);
  }
}

function renderJson(
  value: JsonValue,
  indent: number = 0,
  last: boolean = false,
): HTMLElement {
  if (isJsonObject(value)) {
    const result = document.createElement("div");
    result.appendChild(code(`{\n`, indent));
    const names = Object.keys(value);
    for (let i = 0, len = names.length; i < len; i++) {
      const name = names[i] as string;
      if (value[name] !== undefined) {
        result.appendChild(
          renderObjectName(
            name,
            value[name] as JsonValue,
            indent + 1,
            i == len - 1,
          ),
        );
      }
    }
    result.appendChild(code(`}\n`, indent));
    return result;
  } else if (isJsonArray(value)) {
    const result = document.createElement("div");
    result.appendChild(code(`}[\n`, indent));
    for (let i = 0, len = value.length; i < len; i++) {
      result.appendChild(
        renderJson(
          value[i] as JsonValue,
          indent + 1,
          i == len - 1,
        ),
      );
    }
    result.appendChild(code(`]${last ? "" : ","}\n`, indent));
    return result;
  } else if (isPrimitive(value)) {
    const result = document.createElement("div");
    result.appendChild(
      code(`${JSON.stringify(value)}${last ? "" : ","}`, indent),
    );
    return result;
  }
  throw new Error(`Unhandled case: ${value satisfies never}`);
}

// Render an annotated JSON value
export function renderAnnotatedJson(
  value: JsonValue,
  vRes: AnnotatedJson,
  indent: number = 0,
  last: boolean = false,
): HTMLElement {
  if (isJsonObject(value) && isAnnotatedObject(vRes)) {
    const result = document.createElement("div");
    result.appendChild(code(`{\n`, indent));
    const names = Object.keys(value);
    for (let i = 0, len = names.length; i < len; i++) {
      const name = names[i] as string;
      if (value[name] !== undefined && vRes.object[name] !== undefined) {
        result.appendChild(
          renderAnnotatedObjectName(
            name,
            value[name] as JsonValue,
            vRes.object[name] as AnnotatedJson,
            indent + 1,
            i == len - 1,
          ),
        );
      } else {
        result.appendChild(
          renderObjectName(
            name,
            value[name] as JsonValue,
            indent + 1,
            i == len - 1,
          ),
        );
      }
    }
    result.appendChild(code(`}\n`, indent));
    return result;
  } else if (isJsonArray(value) && isAnnotatedArray(vRes)) {
    console.assert(value.length == vRes.array.length);
    const result = document.createElement("div");
    result.appendChild(code(`}[\n`, indent));
    for (let i = 0, len = value.length; i < len; i++) {
      result.appendChild(
        renderAnnotatedJson(
          value[i] as JsonValue,
          vRes.array[i] as AnnotatedJson,
          indent + 1,
          i == len - 1,
        ),
      );
    }
    result.appendChild(code(`]${last ? "" : ","}\n`, indent));
    return result;
  } else if (isPrimitive(value) && isAnnotation(vRes)) {
    return details(
      `${JSON.stringify(value)}${last ? "" : ","}`,
      vRes,
      indent,
    );
  } else {
    // value doesn't have valid annotation
    return renderJson(value, indent, last);
  }
}
