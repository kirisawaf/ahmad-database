const DB_NAME = "AhmadDatabase";
const DB_VERSION = 1;
let db;
let selectedPhoto = null;
let removeExistingPhoto = false;

const $ = id => document.getElementById(id);
const form = $("customerForm");

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2400);
}
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("customers")) {
        const store = database.createObjectStore("customers", { keyPath: "id" });
        store.createIndex("name", "name", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
function allCustomers() {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("customers", "readonly");
    const req = tx.objectStore("customers").getAll();
    req.onsuccess = () => resolve(req.result.sort((a,b) => a.name.localeCompare(b.name, "id")));
    req.onerror = () => reject(req.error);
  });
}
function saveCustomer(record) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("customers", "readwrite");
    tx.objectStore("customers").put(record);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
function deleteCustomer(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("customers", "readwrite");
    tx.objectStore("customers").delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
function dataURLToBlob(dataURL) {
  const [meta, data] = dataURL.split(",");
  const mime = (meta.match(/data:(.*?);base64/) || [,"application/octet-stream"])[1];
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i=0;i<binary.length;i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], {type:mime});
}
function safeURL(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : "";
  } catch { return ""; }
}
function resetForm() {
  form.reset();
  $("customerId").value = "";
  $("formTitle").textContent = "Tambah pelanggan";
  $("saveBtn").textContent = "Simpan pelanggan";
  $("cancelEdit").classList.add("hidden");
  $("photoPreview").classList.add("hidden");
  $("previewImage").src = "";
  selectedPhoto = null;
  removeExistingPhoto = false;
}
$("photo").addEventListener("change", () => {
  const file = $("photo").files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) { toast("Pilih file foto yang benar."); return; }
  selectedPhoto = file;
  removeExistingPhoto = false;
  $("previewImage").src = URL.createObjectURL(file);
  $("photoPreview").classList.remove("hidden");
});
$("removePhoto").addEventListener("click", () => {
  selectedPhoto = null;
  removeExistingPhoto = true;
  $("photo").value = "";
  $("previewImage").src = "";
  $("photoPreview").classList.add("hidden");
});
form.addEventListener("submit", async event => {
  event.preventDefault();
  const id = $("customerId").value || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const previous = $("customerId").value ? (await allCustomers()).find(c => c.id === id) : null;
  let photo = previous?.photo || null;
  if (selectedPhoto) photo = selectedPhoto;
  if (removeExistingPhoto) photo = null;
  const record = {
    id,
    name: $("name").value.trim(),
    address: $("address").value.trim(),
    maps: safeURL($("maps").value.trim()),
    photo,
    updatedAt: new Date().toISOString()
  };
  if (!record.name || !record.address) { toast("Nama dan alamat wajib diisi."); return; }
  await saveCustomer(record);
  resetForm();
  await render();
  toast("Data pelanggan berhasil disimpan.");
});
$("cancelEdit").addEventListener("click", resetForm);

async function editCustomer(id) {
  const customer = (await allCustomers()).find(c => c.id === id);
  if (!customer) return;
  $("customerId").value = customer.id;
  $("name").value = customer.name;
  $("address").value = customer.address;
  $("maps").value = customer.maps || "";
  selectedPhoto = null;
  removeExistingPhoto = false;
  $("photo").value = "";
  if (customer.photo) {
    $("previewImage").src = URL.createObjectURL(customer.photo);
    $("photoPreview").classList.remove("hidden");
  } else {
    $("photoPreview").classList.add("hidden");
  }
  $("formTitle").textContent = "Edit pelanggan";
  $("saveBtn").textContent = "Simpan perubahan";
  $("cancelEdit").classList.remove("hidden");
  window.scrollTo({top:0,behavior:"smooth"});
}
async function render() {
  const query = $("search").value.trim().toLocaleLowerCase("id");
  const customers = await allCustomers();
  const filtered = customers.filter(c => `${c.name} ${c.address}`.toLocaleLowerCase("id").includes(query));
  $("count").textContent = `${customers.length} pelanggan`;
  $("customerList").innerHTML = "";
  $("empty").classList.toggle("hidden", filtered.length !== 0);
  for (const c of filtered) {
    const card = document.createElement("article");
    card.className = "customer-card";
    if (c.photo) {
      const img = document.createElement("img");
      img.alt = "Foto rumah";
      img.src = URL.createObjectURL(c.photo);
      card.append(img);
    } else {
      const no = document.createElement("div");
      no.className = "no-photo";
      no.textContent = "Belum ada foto";
      card.append(no);
    }
    const info = document.createElement("div");
    const title = document.createElement("h3"); title.textContent = c.name;
    const address = document.createElement("p"); address.textContent = c.address;
    info.append(title,address);
    const actions = document.createElement("div"); actions.className = "card-actions";
    const edit = document.createElement("button"); edit.textContent = "Edit"; edit.addEventListener("click",()=>editCustomer(c.id));
    const del = document.createElement("button"); del.textContent = "Hapus"; del.className = "delete";
    del.addEventListener("click",async()=>{if(confirm(`Hapus data ${c.name}?`)){await deleteCustomer(c.id);await render();toast("Data dihapus.");}});
    actions.append(edit,del);
    if (c.maps) {
      const map = document.createElement("a"); map.textContent = "Buka Maps"; map.href = c.maps; map.target = "_blank"; map.rel = "noopener";
      actions.append(map);
    }
    info.append(actions); card.append(info); $("customerList").append(card);
  }
}
$("search").addEventListener("input", render);

$("exportBtn").addEventListener("click", async () => {
  const customers = await allCustomers();
  const backup = [];
  for (const c of customers) {
    backup.push({...c, photo: c.photo ? await blobToDataURL(c.photo) : null});
  }
  const payload = {app:"Ahmad Database",version:1,createdAt:new Date().toISOString(),customers:backup};
  const blob = new Blob([JSON.stringify(payload)],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download=`ahmad-database-backup-${new Date().toISOString().slice(0,10)}.json`; a.click();
  URL.revokeObjectURL(url);
  toast("File backup dibuat. Pastikan file tersimpan.");
});
$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async () => {
  const file = $("importFile").files[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (payload.app !== "Ahmad Database" || !Array.isArray(payload.customers)) throw new Error("Format backup tidak cocok");
    if (!confirm(`Pulihkan ${payload.customers.length} data? Data dengan ID sama akan diganti.`)) return;
    for (const c of payload.customers) {
      if (!c.id || !c.name || !c.address) continue;
      await saveCustomer({...c, photo:c.photo ? dataURLToBlob(c.photo) : null});
    }
    await render(); toast("Backup berhasil dipulihkan.");
  } catch (e) { alert("Backup gagal dibaca: " + e.message); }
  finally { $("importFile").value = ""; }
});

async function start() {
  try {
    db = await openDB();
    await render();
    $("connection").textContent = navigator.onLine ? "Online" : "Offline";
    $("connection").style.background = navigator.onLine ? "#ffffff20" : "#fef3c7";
    $("connection").style.color = navigator.onLine ? "#fff" : "#713f12";
  } catch (e) {
    $("connection").textContent = "Database error";
    alert("Penyimpanan lokal tidak dapat dibuka. Coba gunakan Chrome.");
  }
}
window.addEventListener("online",()=>{$("connection").textContent="Online";});
window.addEventListener("offline",()=>{$("connection").textContent="Offline";});
if ("serviceWorker" in navigator) window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
start();