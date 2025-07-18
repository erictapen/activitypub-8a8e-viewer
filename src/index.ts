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
): Promise<JsonValue<JsonPrimitive> | DocumentFragment> {
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
  let jsonOrErrorMessage: JsonValue<JsonPrimitive> | DocumentFragment;
  if (input.value === "") {
    jsonOrErrorMessage = cloneTemplate("empty-data");
  } else if (isUrl(input.value)) {
    globalThis.history.replaceState({}, "", `/${input.value}`);
    jsonOrErrorMessage = await fetchApObject(input.value);
    console.log(jsonOrErrorMessage);
  } else {
    try {
      jsonOrErrorMessage = JSON.parse(input.value) as JsonValue<JsonPrimitive>;
    } catch {
      jsonOrErrorMessage = cloneTemplate("invalid-data");
    }
  }
  if (!(jsonOrErrorMessage instanceof DocumentFragment)) {
    const json = jsonOrErrorMessage as JsonValue<JsonPrimitive>;
    if (!isJsonObject(json)) {
      jsonOrErrorMessage = cloneTemplate("invalid-activitystreams-object");
    } else {
      const validationResult = validate(json);
      console.log(validationResult);
      searchResult.replaceChildren(
        renderValidationResult(json, validationResult),
      );
      return;
    }
  }
  const errorMessage = jsonOrErrorMessage;
  globalThis.history.replaceState({}, "", "/");
  searchResult.replaceChildren(errorMessage);
}

const legalTimeZones: string[] = [];
const legalToplevelNames: string[] = ["timezone"];

function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

type AnnotationKind = "Violation" | "Warning" | "Note" | "Correct";

export type JsonAnnotation = {
  kind: AnnotationKind;
  id: string | null;
  text: string;
  reference: string | null;
};

export function isAnnotation(value: unknown): value is JsonAnnotation {
  if (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    "id" in value &&
    "text" in value &&
    "reference" in value
  ) {
    const { kind, id, text, reference } = value as JsonAnnotation;
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

export type JsonValue<T> = T | { [key: string]: JsonValue<T> } | JsonValue<T>[];

function isJsonValue<T>(value: unknown): value is JsonValue<T> {
  return isJsonObject(value) || isJsonArray(value) ||
    // This is technically not correct but good enough for now
    (isPrimitive(value) || isAnnotation(value));
}

export function isJsonObject<T>(
  value: unknown,
): value is { [key: string]: JsonValue<T> } {
  return !Array.isArray(value) && typeof value === "object" && value !== null &&
    Object.values(value).reduce((acc, v) => acc && isJsonValue(v), true);
}

export function isJsonArray<T>(value: unknown): value is JsonValue<T>[] {
  return Array.isArray(value) &&
    value.reduce((acc, v) => acc && isJsonValue(v), true);
}

type Test = {
  value: JsonValue<JsonPrimitive>;
  result: JsonValue<string>;
};

type Rule = {
  name: string;
  validate: (
    self: Record<string, JsonValue<JsonPrimitive>>,
  ) => JsonValue<JsonAnnotation>;
  tests: Test[];
};

export const rules: Rule[] = [
  {
    name: "timezone attribute",
    validate: (self) => {
      if (self["timezone"] === null) {
        return {
          "timezone": {
            kind: "Violation",
            id: "NoTimezoneSet",
            text: "The timezone property is either null or doesn't exist",
            reference: null,
          },
        };
      } else if (typeof self["timezone"] !== "string") {
        return {
          "timezone": {
            kind: "Violation",
            id: "InvalidTimezone",
            text: `The timezone {self["timezone"]} is not a string`,
            reference:
              "https://codeberg.org/fediverse/fep/src/branch/main/fep/8a8e/fep-8a8e.md#time-zone",
          },
        };
      } else if (legalTimeZones.includes(self["timezone"])) {
        return {
          "timezone": {
            kind: "Warning",
            id: "InvalidTimezone",
            text: `The timezone {self["timezone"]} is not a valid timezone`,
            reference:
              "https://codeberg.org/fediverse/fep/src/branch/main/fep/8a8e/fep-8a8e.md#time-zone",
          },
        };
      } else {
        return {
          "timezone": {
            kind: "Correct",
            id: null,
            reference: null,
            text: "Valid timezone",
          },
        };
      }
    },
    tests: [{
      value: { timezone: null },
      result: { timezone: "NoTimezoneSet" },
    }, {
      value: {},
      result: { timezone: "InvalidTimezone" },
    }],
  },
  {
    name: "remaining attributes",
    validate: (self) => {
      const result: JsonValue<JsonAnnotation> = {};
      for (const name in self) {
        if (!legalToplevelNames.includes(name)) {
          result[name] = {
            kind: "Note",
            id: "UnknownToplevelName",
            text:
              `${name} is not defined in the standard and is therefore not checked`,
            reference: null,
          };
        }
      }
      return result;
    },
    tests: [{
      value: { someattribute: "somevalue" },
      result: { someattribute: "UnknownToplevelName" },
    }],
  },
  {
    name: "to attribute",
    validate: (self) => {
      if (isJsonArray(self["to"])) {
        return {
          "to": (self["to"].map((url: JsonValue<JsonPrimitive>) =>
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
        };
      } else {
        return {
          "to": {
            kind: "Violation",
            id: "InvalidArray",
            text: `The to field {self["to"]} is not an array`,
            reference: null,
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
  apObject: Record<string, JsonValue<JsonPrimitive>>,
): JsonValue<JsonAnnotation> {
  let result = {};
  for (const rule of rules) {
    // TODO this needs to do a deep merge
    result = { ...result, ...(rule.validate(apObject)) };
  }
  return result;
}

const annotationSignifiers: Record<AnnotationKind, string> = {
  "Violation": "🚫",
  "Warning": "⚠️",
  "Note": "📝",
  "Correct": "✅",
};

function details(
  summaryString: string,
  vRes: JsonAnnotation,
): HTMLElement {
  const details = document.createElement("details");
  details.classList.add(vRes.kind);
  const code = document.createElement("code");
  code.textContent = summaryString;
  const summary = document.createElement("summary");
  summary.appendChild(code);
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
  value: JsonValue<JsonPrimitive>,
  vRes: JsonValue<JsonAnnotation>,
  indent: number,
  last: boolean,
): HTMLElement {
  if (isPrimitive(value) && isAnnotation(vRes)) {
    return details(
      `${"  ".repeat(indent)}"${name}": ${JSON.stringify(value)}${
        last ? "" : ","
      }`,
      vRes,
    );
  } else if (
    isJsonObject(value) && isJsonObject(vRes) && (!isAnnotation(vRes))
  ) {
    const result = document.createElement("div");
    const open = document.createElement("code");
    open.textContent = `${"  ".repeat(indent)}"${name}": {\n`;
    result.appendChild(open);
    const names = Object.keys(value);
    for (let i = 0, len = names.length; i < len; i++) {
      const name = names[i] as string;
      if (value[name] !== undefined && vRes[name] !== undefined) {
        result.appendChild(
          renderObjectName(
            name,
            value[name] as JsonValue<JsonPrimitive>,
            vRes[name] as JsonValue<JsonAnnotation>,
            indent + 1,
            i == len - 1,
          ),
        );
      }
    }
    const close = document.createElement("code");
    close.textContent = `${"  ".repeat(indent)}}${last ? "" : ","}\n`;
    result.appendChild(close);
    return result;
  } else if (isJsonArray(value) && isJsonArray(vRes)) {
    const result = document.createElement("div");
    const open = document.createElement("code");
    open.textContent = `${"  ".repeat(indent)}"${name}": [\n`;
    result.appendChild(open);
    for (let i = 0, len = value.length; i < len; i++) {
      result.appendChild(
        renderValidationResult(
          value[i] as JsonValue<JsonPrimitive>,
          vRes[i] as JsonValue<JsonAnnotation>,
          indent + 1,
          i == len - 1,
        ),
      );
    }
    const close = document.createElement("code");
    close.textContent = `${" ".repeat(indent * 2)}]${last ? "" : ","}\n`;
    result.appendChild(close);
    return result;
  } else {
    // This should be unreachable
    return document.createElement("div");
  }
}

export function renderValidationResult(
  value: JsonValue<JsonPrimitive>,
  vRes: JsonValue<JsonAnnotation>,
  indent: number = 0,
  last: boolean = false,
): HTMLElement {
  if (isJsonObject(value) && isJsonObject(vRes) && (!isAnnotation(vRes))) {
    const result = document.createElement("div");
    const open = document.createElement("code");
    open.textContent = `${"  ".repeat(indent)}{\n`;
    result.appendChild(open);
    const names = Object.keys(value);
    for (let i = 0, len = names.length; i < len; i++) {
      const name = names[i] as string;
      if (value[name] !== undefined && vRes[name] !== undefined) {
        result.appendChild(
          renderObjectName(
            name,
            value[name] as JsonValue<JsonPrimitive>,
            vRes[name] as JsonValue<JsonAnnotation>,
            indent + 1,
            i == len - 1,
          ),
        );
      }
    }
    const close = document.createElement("code");
    close.textContent = `${"  ".repeat(indent)}}\n`;
    result.appendChild(close);
    return result;
  } else if (isJsonArray(value) && isJsonArray(vRes)) {
    const result = document.createElement("div");
    const open = document.createElement("code");
    open.textContent = `${"  ".repeat(indent)}[\n`;
    result.appendChild(open);
    console.assert(value.length == vRes.length);
    for (let i = 0, len = value.length; i < len; i++) {
      result.appendChild(
        renderValidationResult(
          value[i] as JsonValue<JsonPrimitive>,
          vRes[i] as JsonValue<JsonAnnotation>,
          indent + 1,
          i == len - 1,
        ),
      );
    }
    const close = document.createElement("code");
    close.textContent = `${" ".repeat(indent * 2)}]${last ? "" : ","}\n`;
    result.appendChild(close);
    return result;
  } else if (isPrimitive(value) && isAnnotation(vRes)) {
    return details(
      `${"  ".repeat(indent)}${JSON.stringify(value)}${last ? "" : ","}`,
      vRes,
    );
  } else {
    // This should be unreachable
    return document.createElement("div");
  }
}
