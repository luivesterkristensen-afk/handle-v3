/* ---------- Firebase-moduler indlæses direkte fra Googles CDN ---------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { firebaseConfig, LIST_ID } from "./firebase-config.js";

/* ---------- Supermarkedets afdelinger i den rækkefølge, de vises ---------- */
const CATEGORIES = [
  "Frugt & grønt", "Brød & bager", "Mejeri & køl", "Kød & fisk", "Frost",
  "Kolonial", "Drikkevarer", "Snacks & slik", "Husholdning", "Personlig pleje", "Andet"
];

/* ---------- Referencer til sidens HTML-elementer ---------- */
const productSearch = document.querySelector("#productSearch");
const clearSearch = document.querySelector("#clearSearch");
const searchResults = document.querySelector("#searchResults");
const shoppingList = document.querySelector("#shoppingList");
const emptyState = document.querySelector("#emptyState");
const itemCount = document.querySelector("#itemCount");
const clearList = document.querySelector("#clearList");
const syncStatus = document.querySelector("#syncStatus");
const toast = document.querySelector("#toast");
const customModal = document.querySelector("#customModal");
const customForm = document.querySelector("#customForm");
const customName = document.querySelector("#customName");
const customCategory = document.querySelector("#customCategory");
const accessModal = document.querySelector("#accessModal");
const accessForm = document.querySelector("#accessForm");
const accessPassword = document.querySelector("#accessPassword");
const accessError = document.querySelector("#accessError");

const ACCESS_PASSWORD = "paw";
const ACCESS_STORAGE_KEY = "handleliste-access-granted";

/* ---------- Appens aktuelle data i browseren ---------- */
let db;
let items = [];
let catalogProducts = [];
let customProducts = [];
let toastTimer;

/* ---------- Kontrollér at Firebase-konfigurationen er udfyldt ---------- */
function hasFirebaseConfig() {
  return firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("INDSAET_") &&
    firebaseConfig.projectId && !firebaseConfig.projectId.startsWith("INDSAET_");
}

/* ---------- Fyld kategori-menuen til nye varer ---------- */
function fillCategorySelect() {
  customCategory.innerHTML = CATEGORIES
    .map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("");
}

/* ---------- Hent det indbyggede katalog med 1.000 varer ---------- */
async function loadCatalog() {
  try {
    const response = await fetch("products.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Produktkataloget kunne ikke indlæses.");
    const data = await response.json();
    catalogProducts = Array.isArray(data) ? data : [];
  } catch (error) {
    catalogProducts = [];
    showToast(error.message);
  }
}

/* ---------- Saml kataloget og brugeroprettede varer uden dubletter ---------- */
function getAllProducts() {
  const productMap = new Map();
  [...customProducts, ...catalogProducts].forEach(product => {
    if (!product?.name || !product?.category) return;
    const key = normalize(product.name);
    if (!productMap.has(key)) productMap.set(key, product);
  });
  return [...productMap.values()];
}

/* ---------- Vis højst 20 relevante resultater under søgefeltet ---------- */
function renderSearchResults() {
  const searchText = normalize(productSearch.value);
  clearSearch.hidden = searchText.length === 0;

  if (!searchText) {
    searchResults.hidden = true;
    searchResults.innerHTML = "";
    return;
  }

  const matches = getAllProducts()
    .filter(product => normalize(product.name).includes(searchText))
    .sort((a, b) => {
      const aStarts = normalize(a.name).startsWith(searchText) ? 0 : 1;
      const bStarts = normalize(b.name).startsWith(searchText) ? 0 : 1;
      return aStarts - bStarts || a.name.localeCompare(b.name, "da");
    })
    .slice(0, 20);

  if (matches.length === 0) {
    searchResults.innerHTML = '<p class="no-results">Varen findes ikke. Brug plusknappen for at oprette den.</p>';
    searchResults.hidden = false;
    return;
  }

  searchResults.innerHTML = matches.map((product, index) => `
    <div class="result-row">
      <button class="result-button" type="button" data-product-index="${index}">
        <span><span class="result-name">${escapeHtml(product.name)}</span>
        <span class="result-category">${escapeHtml(product.category)}</span></span>
        <span class="result-plus">+</span>
      </button>
      ${product.isCustom ? `<button class="custom-product-delete" type="button" data-delete-product-id="${escapeHtml(product.id)}" aria-label="Slet ${escapeHtml(product.name)} fra søgningen"><span class="material-symbols-outlined" aria-hidden="true">delete</span></button>` : ""}
    </div>`).join("");

  searchResults.dataset.matches = JSON.stringify(matches);
  searchResults.hidden = false;
}

/* ---------- Tilføj en katalogvare direkte, når et søgeresultat vælges ---------- */
searchResults.addEventListener("click", async event => {
  const deleteButton = event.target.closest("button[data-delete-product-id]");
  if (deleteButton && db) {
    deleteButton.disabled = true;
    try {
      setSyncStatus("", "Sletter");
      await deleteDoc(doc(db, "shoppingLists", LIST_ID, "products", deleteButton.dataset.deleteProductId));
      showToast("Varen er slettet fra søgningen.");
    } catch (error) {
      handleFirebaseError(error);
    } finally {
      deleteButton.disabled = false;
    }
    return;
  }

  const button = event.target.closest("button[data-product-index]");
  if (!button || !db) return;
  const matches = JSON.parse(searchResults.dataset.matches || "[]");
  const product = matches[Number(button.dataset.productIndex)];
  if (!product) return;

  button.disabled = true;
  try {
    setSyncStatus("", "Gemmer");
    await addDoc(itemsCollection(), {
      name: product.name,
      category: product.category,
      completed: false,
      createdAt: serverTimestamp()
    });
    productSearch.value = "";
    renderSearchResults();
    showToast("Varen er tilføjet.");
  } catch (error) {
    handleFirebaseError(error);
  } finally {
    button.disabled = false;
  }
});

/* ---------- Opdatér søgeresultater mens brugeren skriver ---------- */
productSearch.addEventListener("input", renderSearchResults);
clearSearch.addEventListener("click", () => {
  productSearch.value = "";
  renderSearchResults();
  productSearch.focus();
});

/* ---------- Åbn dialogen til en vare, der ikke findes ---------- */
document.querySelector("#openCustomModal").addEventListener("click", () => {
  customForm.reset();
  customName.value = productSearch.value.trim();
  customCategory.value = CATEGORIES[0];
  customModal.showModal();
  setTimeout(() => customName.focus(), 50);
});

/* ---------- Gem en ny produktdefinition og tilføj varen til listen ---------- */
customForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!db) return;
  const name = customName.value.trim();
  const category = customCategory.value;
  if (!name || !CATEGORIES.includes(category)) {
    return showToast("Kontrollér varen og afdelingen.");
  }

  const button = customForm.querySelector(".primary-button");
  button.disabled = true;
  try {
    setSyncStatus("", "Gemmer");
    const productId = makeProductId(name);
    await setDoc(doc(db, "shoppingLists", LIST_ID, "products", productId), {
      name, category, normalizedName: normalize(name), updatedAt: serverTimestamp()
    }, { merge: true });
    await addDoc(itemsCollection(), { name, category, completed: false, createdAt: serverTimestamp() });
    customModal.close();
    productSearch.value = "";
    renderSearchResults();
    showToast("Varen er gemt og tilføjet.");
  } catch (error) {
    handleFirebaseError(error);
  } finally {
    button.disabled = false;
  }
});

/* ---------- Luk dialoger via krydset eller baggrunden ---------- */
document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => document.querySelector(`#${button.dataset.close}`).close());
});
[customModal].forEach(modal => {
  modal.addEventListener("click", event => { if (event.target === modal) modal.close(); });
});

/* ---------- Tøm hele listen ---------- */
clearList.addEventListener("click", async () => {
  if (!db || items.length === 0) return;
  clearList.disabled = true;
  try {
    setSyncStatus("", "Tømmer");
    await Promise.all(items.map(item => deleteDoc(doc(db, "shoppingLists", LIST_ID, "items", item.id))));
    showToast("Liste blev tømt");
  } catch (error) {
    handleFirebaseError(error);
  } finally {
    clearList.disabled = false;
  }
});

/* ---------- Håndtér afkrydsning og sletning direkte i Firestore ---------- */
shoppingList.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button || !db) return;
  button.disabled = true;
  try {
    setSyncStatus("", "Gemmer");
    const itemRef = doc(db, "shoppingLists", LIST_ID, "items", button.dataset.id);
    if (button.dataset.action === "delete") {
      await deleteDoc(itemRef);
      showToast("Varen er slettet.");
    } else {
      const item = items.find(entry => entry.id === button.dataset.id);
      if (item) await updateDoc(itemRef, { completed: !item.completed, updatedAt: serverTimestamp() });
    }
  } catch (error) {
    handleFirebaseError(error);
  } finally {
    button.disabled = false;
  }
});

/* ---------- Firestore-stier til den valgte fælles liste ---------- */
function itemsCollection() {
  return collection(db, "shoppingLists", LIST_ID, "items");
}

/* ---------- Lyt på listen og opdatér automatisk på alle enheder ---------- */
function startRealtimeListeners() {
  const itemQuery = query(itemsCollection(), orderBy("createdAt", "asc"));
  onSnapshot(itemQuery, snapshot => {
    items = snapshot.docs.map(itemDoc => ({ id: itemDoc.id, ...itemDoc.data() }));
    renderList();
    setSyncStatus("online", "Synkroniseret");
  }, handleFirebaseError);

  const productsRef = collection(db, "shoppingLists", LIST_ID, "products");
  onSnapshot(productsRef, snapshot => {
    customProducts = snapshot.docs.map(productDoc => ({
      id: productDoc.id,
      ...productDoc.data(),
      isCustom: true
    }));
    if (productSearch.value.trim()) renderSearchResults();
  }, handleFirebaseError);
}

/* ---------- Sortér og vis handlelisten opdelt efter afdeling ---------- */
function renderList() {
  shoppingList.innerHTML = CATEGORIES.map(category => {
    const categoryItems = items.filter(item => item.category === category).sort((a, b) => {
      if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
      return a.name.localeCompare(b.name, "da", { sensitivity: "base" });
    });
    if (!categoryItems.length) return "";
    return `<article class="category-section"><h2 class="category-heading">${escapeHtml(category)} <span>${categoryItems.length}</span></h2>${categoryItems.map(renderItem).join("")}</article>`;
  }).join("");

  emptyState.hidden = items.length !== 0;
  clearList.hidden = items.length === 0;
  const activeItems = items.filter(item => !item.completed).length;
  itemCount.textContent = `${activeItems} ${activeItems === 1 ? "vare" : "varer"}`;
}

/* ---------- Lav HTML for én vare på listen ---------- */
function renderItem(item) {
  return `<div class="item-row ${item.completed ? "completed" : ""}">
    <button class="check-button" type="button" data-action="toggle" data-id="${escapeHtml(item.id)}" aria-label="Kryds vare af"><span class="checkbox-visual">✓</span></button>
    <div class="item-text"><span class="item-name">${escapeHtml(item.name)}</span></div>
    <button class="delete-button" type="button" data-action="delete" data-id="${escapeHtml(item.id)}" aria-label="Slet vare">×</button>
  </div>`;
}

/* ---------- Vis forbindelsesstatus og fejl ---------- */
function setSyncStatus(state, text) {
  syncStatus.className = `sync-status ${state}`.trim();
  syncStatus.lastElementChild.textContent = text;
}
function handleFirebaseError(error) {
  console.error(error);
  setSyncStatus("error", "Ingen forbindelse");
  const message = error?.code === "permission-denied"
    ? "Firebase-reglerne tillader ikke adgang. Se README-filen."
    : "Firebase kunne ikke synkronisere listen.";
  showToast(message);
}
function showToast(message) {
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("visible");
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
}

/* ---------- Små hjælpefunktioner ---------- */
function normalize(value) {
  return String(value || "").trim().toLocaleLowerCase("da-DK");
}
function makeProductId(name) {
  return normalize(name).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || crypto.randomUUID();
}
function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

/* ---------- Bed om adgangskode én gang pr. browser ---------- */
function hasSavedAccess() {
  try {
    return localStorage.getItem(ACCESS_STORAGE_KEY) === "yes";
  } catch {
    return false;
  }
}

function saveAccess() {
  try {
    localStorage.setItem(ACCESS_STORAGE_KEY, "yes");
  } catch {
    // Appen åbnes stadig, hvis browseren blokerer lokal lagring.
  }
}

function requireAccess() {
  if (hasSavedAccess()) return Promise.resolve();

  accessModal.addEventListener("cancel", event => event.preventDefault());
  accessModal.showModal();
  setTimeout(() => accessPassword.focus(), 50);

  return new Promise(resolve => {
    function handleAccessSubmit(event) {
      event.preventDefault();
      if (accessPassword.value !== ACCESS_PASSWORD) {
        accessError.hidden = false;
        accessPassword.select();
        return;
      }

      saveAccess();
      accessError.hidden = true;
      accessForm.reset();
      accessModal.close();
      accessForm.removeEventListener("submit", handleAccessSubmit);
      resolve();
    }

    accessForm.addEventListener("submit", handleAccessSubmit);
  });
}

/* ---------- Start kataloget og Firebase ---------- */
async function startApp() {
  fillCategorySelect();
  await loadCatalog();
  if (!hasFirebaseConfig()) {
    setSyncStatus("error", "Firebase mangler");
    showToast("Indsæt Firebase-konfigurationen i firebase-config.js.");
    return;
  }
  try {
    const firebaseApp = initializeApp(firebaseConfig);
    db = getFirestore(firebaseApp);
    startRealtimeListeners();
  } catch (error) {
    handleFirebaseError(error);
  }
}

requireAccess().then(startApp);

/* ---------- Registrér appen til installation og offline appskal ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(error => {
      console.error("Service worker kunne ikke registreres.", error);
    });
  });
}
