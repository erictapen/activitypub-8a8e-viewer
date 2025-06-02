
export function handleApUrl(_: Event) {
  let input = document.getElementById("ap-input") as HTMLInputElement;
  let searchResult = document.getElementById("searchresult") as HTMLElement;
  fetch(input.value, { headers: { "Accept": "application/activity+json"}}).then(async response => {
    searchResult.innerHTML = "<ul>";
    for (const key in await response.json()) {
      searchResult.innerHTML += `<li>${key}</li>`;
    }
    searchResult.innerHTML += "</ul>";
  });
  window.history.pushState({}, "", `/${input.value}`);
}
