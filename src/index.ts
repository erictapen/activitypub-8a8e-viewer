export function init() {
  document.getElementById("ap-input")?.addEventListener("input", handleApUrl);
  let input = document.getElementById("ap-input") as HTMLInputElement;
  input.value = window.location.pathname.slice(1);
  input.dispatchEvent(new Event("input", {}));
}

export function handleApUrl(_: Event) {
  let input = document.getElementById("ap-input") as HTMLInputElement;
  let searchResult = document.getElementById("searchresult") as HTMLElement;
  fetch(input.value, { headers: { "Accept": "application/activity+json"}}).then(async response => {
    const obj = await response.json();
    searchResult.innerHTML = "<ul>";
    for (const key in obj) {
      searchResult.innerHTML += `<li>${key}: ${JSON.stringify(obj[key])}</li>`;
    }
    searchResult.innerHTML += "</ul>";
  });
  window.history.replaceState({}, "", `/${input.value}`);
}
