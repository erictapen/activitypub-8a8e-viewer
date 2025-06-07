export function init() {
  document.getElementById("ap-input")?.addEventListener("input", handleApUrl);
  const input = document.getElementById("ap-input") as HTMLInputElement;
  input.value = globalThis.location.pathname.slice(1);
  input.dispatchEvent(new Event("input", {}));
}

export function handleApUrl(_: Event) {
  const input = document.getElementById("ap-input") as HTMLInputElement;
  const searchResult = document.getElementById("searchresult") as HTMLElement;
  fetch(input.value, { headers: { Accept: "application/activity+json" } }).then(
    async (response) => {
      const obj = await response.json();
      searchResult.innerHTML = "<ul>";
      for (const key in obj) {
        searchResult.innerHTML += `<li>${key}: ${
          JSON.stringify(
            obj[key],
          )
        }</li>`;
      }
      searchResult.innerHTML += "</ul>";
    },
  );
  globalThis.history.replaceState({}, "", `/${input.value}`);
}
